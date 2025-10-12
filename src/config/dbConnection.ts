import mongoose from "mongoose";
import logger from "./loggingConfig";
import { env } from "../utils/env";

let cached: { conn: typeof mongoose | null } = { conn: null };

export const connectDB = async () => {
  if (cached.conn) {
    logger.info("✅ [connectDB] Using cached MongoDB connection");
    console.log("✅ [connectDB] Using cached MongoDB connection");
    return cached.conn;
  }
  
  try {
    console.log("🟢 [connectDB] Starting MongoDB connection process...");
    // Only log the MongoDB URL in non-production environments
    if (env.NODE_ENV === 'development') {
      logger.info(`Connecting to MongoDB with URL: ${env.MONGODB_URL}`);
      console.log(`🟢 [connectDB] MongoDB URL: ${env.MONGODB_URL}`);
    }

    // Log Mongoose connection state before attempting connection
    console.log(`🟢 [connectDB] Mongoose connection state BEFORE connect(): ${mongoose.connection.readyState}`);

    const conn = await mongoose.connect(env.MONGODB_URL, {
      minPoolSize: env.MONGODB_MIN_POOL_SIZE,
      maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    cached.conn = conn;
    logger.info("✅ [connectDB] MongoDB connected successfully");

    // Log connection state after connect
    console.log(`✅ [connectDB] Mongoose connection state AFTER connect(): ${mongoose.connection.readyState}`);
    logger.info("Successful connection to MongoDB.");

    // Listen to connection events
    mongoose.connection.on("connected", () => {
      console.log("✅ [connectDB] Mongoose connected event fired");
    });
    mongoose.connection.on("error", (err) => {
      console.error("❌ [connectDB] Mongoose connection error event fired:", err);
    });
    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ [connectDB] Mongoose disconnected event fired");
    });
    return conn;
  } catch (error) {
    logger.error('Failed connection to MongoDB:', error);
    console.error("❌ [connectDB] Failed to connect to MongoDB:", error);
    throw error;
  }
};