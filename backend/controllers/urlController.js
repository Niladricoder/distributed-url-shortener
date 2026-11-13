const Url = require("../models/Url");
const { snowflake } = require("../utils/snowflake");
const { getRedisClient } = require("../Redis_connection");

/**
 * Helper to validate URL syntax.
 */
function isValidUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
}

/**
 * POST /api/urls/shorten
 * Shortens a long URL passed in req.body
 */
async function shortenUrl(req, res, next) {
  try {
    // Read long URL from req.body (accepts "url" or "originalUrl")
    const originalUrl = req.body.url || req.body.originalUrl;

    if (!originalUrl || typeof originalUrl !== "string") {
      return res.status(400).json({
        error: "Missing or invalid URL. Please pass 'url' or 'originalUrl' in req.body.",
      });
    }

    const trimmedUrl = originalUrl.trim();

    if (!isValidUrl(trimmedUrl)) {
      return res.status(400).json({
        error: "Invalid URL protocol. URLs must start with http:// or https://",
      });
    }

    // Check if the URL was already shortened
    const existing = await Url.findOne({ originalUrl: trimmedUrl });
    if (existing) {
      // Refresh Redis cache
      const redis = getRedisClient();
      if (redis) {
        try {
          await redis.set(`url:${existing.shortCode}`, existing.originalUrl, { EX: 86400 });
        } catch (err) {
          console.warn("Failed to update Redis cache:", err.message);
        }
      }

      return res.status(200).json({
        message: "URL already shortened",
        shortCode: existing.shortCode,
        shortUrl: `${req.protocol}://${req.get("host")}/${existing.shortCode}`,
        originalUrl: existing.originalUrl,
        snowflakeId: existing.snowflakeId,
      });
    }

    // Generate unique Snowflake ID and Base62 short code
    const { snowflakeId, shortCode } = snowflake.generateShortCode();

    // Save to MongoDB
    const urlRecord = await Url.create({
      originalUrl: trimmedUrl,
      shortCode,
      snowflakeId,
    });

    // Cache-Aside: write to Redis (TTL 24 hours = 86400 seconds)
    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.set(`url:${shortCode}`, trimmedUrl, { EX: 86400 });
      } catch (err) {
        console.warn("Failed to set Redis cache:", err.message);
      }
    }

    return res.status(201).json({
      message: "URL shortened successfully",
      shortCode: urlRecord.shortCode,
      shortUrl: `${req.protocol}://${req.get("host")}/${urlRecord.shortCode}`,
      originalUrl: urlRecord.originalUrl,
      snowflakeId: urlRecord.snowflakeId,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /:shortCode (and GET /api/urls/:shortCode)
 * Cache-aside retrieval: returns original URL in response body.
 * If ?redirect=true is present in query, performs HTTP 302 redirect.
 */
async function getUrlByShortCode(req, res, next) {
  try {
    const { shortCode } = req.params;

    if (!shortCode) {
      return res.status(400).json({ error: "shortCode parameter is required." });
    }

    const cacheKey = `url:${shortCode}`;
    const redis = getRedisClient();

    const isBrowserNavigation = req.headers.accept && req.headers.accept.includes("text/html");
    const wantsRedirect = req.query.redirect === "true" || (isBrowserNavigation && req.query.json !== "true");

    // 1. Check Redis Cache
    if (redis) {
      try {
        const cachedUrl = await redis.get(cacheKey);
        if (cachedUrl) {
          // Asynchronously increment click count in MongoDB
          Url.updateOne(
            { shortCode },
            { $inc: { clicks: 1 }, $set: { lastAccessedAt: new Date() } }
          ).catch((err) => console.warn("Failed to increment click count:", err.message));

          if (wantsRedirect) {
            return res.redirect(302, cachedUrl);
          }

          return res.status(200).json({
            originalUrl: cachedUrl,
            shortCode,
            source: "cache",
          });
        }
      } catch (err) {
        console.warn("Redis GET error, falling back to database:", err.message);
      }
    }

    // 2. Cache Miss: Query MongoDB
    const urlRecord = await Url.findOne({ shortCode });

    if (!urlRecord) {
      return res.status(404).json({
        error: "Short URL not found",
        shortCode,
      });
    }

    // Populate Redis Cache for subsequent requests
    if (redis) {
      try {
        await redis.set(cacheKey, urlRecord.originalUrl, { EX: 86400 });
      } catch (err) {
        console.warn("Failed to populate Redis cache:", err.message);
      }
    }

    // Increment click count
    await Url.updateOne(
      { _id: urlRecord._id },
      { $inc: { clicks: 1 }, $set: { lastAccessedAt: new Date() } }
    );

    if (wantsRedirect) {
      return res.redirect(302, urlRecord.originalUrl);
    }

    // Return the original URL in the response body as requested
    return res.status(200).json({
      originalUrl: urlRecord.originalUrl,
      shortCode: urlRecord.shortCode,
      source: "database",
      clicks: urlRecord.clicks + 1,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  shortenUrl,
  getUrlByShortCode,
};
