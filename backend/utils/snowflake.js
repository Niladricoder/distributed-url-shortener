const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const { encode } = require("./base62");

class Snowflake {
  /**
   * @param {number|string|bigint} workerId - Worker ID from .env
   * @param {bigint} [customEpoch] - Custom Epoch in milliseconds
   */
  constructor(workerId, customEpoch) {
    if (workerId === undefined || workerId === null || workerId === "") {
      throw new Error("Worker ID is strictly required from .env. No default value is allowed.");
    }

    const parsedWorkerId = BigInt(workerId);

    // Custom Epoch: 2024-01-01T00:00:00.000Z in milliseconds
    this.epoch = customEpoch !== undefined ? BigInt(customEpoch) : 1704067200000n;

    // Bit lengths
    this.workerIdBits = 10n; // Up to 1024 workers (0 to 1023)
    this.sequenceBits = 12n; // Up to 4096 IDs per ms per worker

    // Max values
    this.maxWorkerId = (1n << this.workerIdBits) - 1n; // 1023
    this.sequenceMask = (1n << this.sequenceBits) - 1n; // 4095

    // Bit shifts
    this.workerIdShift = this.sequenceBits; // 12
    this.timestampLeftShift = this.sequenceBits + this.workerIdBits; // 22

    if (parsedWorkerId < 0n || parsedWorkerId > this.maxWorkerId) {
      throw new Error(`Worker ID must be between 0 and ${this.maxWorkerId}. Received: ${parsedWorkerId}`);
    }

    this.workerId = parsedWorkerId;
    this.sequence = 0n;
    this.lastTimestamp = -1n;
  }

  waitNextMillis(lastTimestamp) {
    let timestamp = BigInt(Date.now());
    while (timestamp <= lastTimestamp) {
      timestamp = BigInt(Date.now());
    }
    return timestamp;
  }

  /**
   * Generates next 64-bit Snowflake ID as BigInt.
   * @returns {bigint}
   */
  nextId() {
    let timestamp = BigInt(Date.now());

    if (timestamp < this.lastTimestamp) {
      throw new Error(`Clock moved backwards. Refusing to generate ID for ${this.lastTimestamp - timestamp}ms`);
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & this.sequenceMask;
      if (this.sequence === 0n) {
        timestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    const id =
      ((timestamp - this.epoch) << this.timestampLeftShift) |
      (this.workerId << this.workerIdShift) |
      this.sequence;

    return id;
  }

  nextIdStr() {
    return this.nextId().toString();
  }

  /**
   * Generates a unique Base62 encoded short code using the Snowflake ID.
   * @returns {{ snowflakeId: string, shortCode: string }}
   */
  generateShortCode() {
    const id = this.nextId();
    return {
      snowflakeId: id.toString(),
      shortCode: encode(id),
    };
  }
}

// Read worker ID strictly from SERVER1_WORKER_ID in .env (no default fallback)
const workerIdFromEnv = process.env.SERVER1_WORKER_ID;

if (!workerIdFromEnv) {
  throw new Error("Missing SERVER1_WORKER_ID in .env file. Please define SERVER1_WORKER_ID.");
}

const snowflake = new Snowflake(workerIdFromEnv);

module.exports = {
  Snowflake,
  snowflake,
};
