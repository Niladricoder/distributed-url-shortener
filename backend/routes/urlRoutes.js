const express = require("express");
const router = express.Router();
const { shortenUrl, getUrlByShortCode } = require("../controllers/urlController");

// POST /api/urls/shorten
router.post("/shorten", shortenUrl);

// GET /api/urls/:shortCode
router.get("/:shortCode", getUrlByShortCode);

module.exports = router;
