const BASE62_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE = BigInt(BASE62_CHARS.length); // 62n

/**
 * Encodes a numeric value (BigInt, number, or numeric string) into a Base62 string.
 * @param {bigint|number|string} num
 * @returns {string} Base62 encoded string
 */
function encode(num) {
  let bigNum = BigInt(num);

  if (bigNum < 0n) {
    throw new Error("Base62 encoding only supports non-negative integers.");
  }

  if (bigNum === 0n) {
    return BASE62_CHARS[0];
  }

  let result = "";
  while (bigNum > 0n) {
    const remainder = Number(bigNum % BASE);
    result = BASE62_CHARS[remainder] + result;
    bigNum = bigNum / BASE;
  }

  return result;
}

/**
 * Decodes a Base62 string back into a BigInt numeric ID.
 * @param {string} str
 * @returns {bigint}
 */
function decode(str) {
  if (!str || typeof str !== "string") {
    throw new Error("Invalid string input for Base62 decoding.");
  }

  let num = 0n;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const index = BASE62_CHARS.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid Base62 character: '${char}'`);
    }
    num = num * BASE + BigInt(index);
  }

  return num;
}

module.exports = {
  encode,
  decode,
  BASE62_CHARS,
};
