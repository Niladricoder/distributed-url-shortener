const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

async function connectDB() {
  const mongoUrl = process.env.MONGO_URI || process.env.mongo_url;
  const dbName = process.env.DB_NAME;

  if (!mongoUrl) {
    throw new Error("Missing MONGO_URI in .env file.");
  }

  if (!dbName) {
    throw new Error("Missing DB_NAME in .env file.");
  }

  try {
    await mongoose.connect(mongoUrl, { dbName });
    console.log(`Connected to MongoDB (${dbName}) successfully.`);
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    throw error;
  }
}

module.exports = connectDB;
