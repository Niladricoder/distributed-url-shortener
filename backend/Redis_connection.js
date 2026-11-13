const { createClient } = require("redis");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

let redisClient = null;

async function connectRedis() {
  const redisUrl = process.env.REDIS_URL;

  // If REDIS_URL is not configured, we gracefully operate without Redis cache
  if (!redisUrl) {
    console.log("REDIS_URL not set in .env. Running without Redis cache layer.");
    return null;
  }

  try {
    redisClient = createClient({ url: redisUrl });

    redisClient.on("error", (err) => {
      console.warn("Redis client warning:", err.message);
    });

    redisClient.on("connect", () => {
      console.log("Connected to Redis successfully.");
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.warn("Could not connect to Redis (operating with database fallback):", error.message);
    redisClient = null;
    return null;
  }
}

function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }
  return null;
}

module.exports = {
  connectRedis,
  getRedisClient,
};
