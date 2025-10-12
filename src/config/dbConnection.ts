import mongoose from "mongoose";
import logger from "./loggingConfig";
import { env } from "../utils/env";

// Retry configuration
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

let cached: { conn: typeof mongoose | null } = { conn: null };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const connectDB = async () => {
  if (cached.conn) {
    logger.info("✅ [connectDB] Using cached MongoDB connection");
    console.log("✅ [connectDB] Using cached MongoDB connection");
    return cached.conn;
  }
  
  console.log("🟢 [connectDB] Starting MongoDB connection process...");
  // Only log the MongoDB URL in non-production environments
  if (env.NODE_ENV === 'development') {
    logger.info(`Connecting to MongoDB with URL: ${env.MONGODB_URL}`);
    console.log(`🟢 [connectDB] MongoDB URL: ${env.MONGODB_URL}`);
  }

  // Log Mongoose connection state before attempting connection
  console.log(`🟢 [connectDB] Mongoose connection state BEFORE connect(): ${mongoose.connection.readyState}`);

  // ✅ Set global buffering timeout before connecting
  mongoose.set("bufferTimeoutMS", 60000);

  let attempt = 0;
  let conn: typeof mongoose | null = null;

  while (attempt < MAX_RETRIES) {
    attempt++;

    try {
      console.log(`🟢 [connectDB] Attempt ${attempt} to connect to MongoDB...`);

      conn = await mongoose.connect(env.MONGODB_URL, {
        minPoolSize: env.MONGODB_MIN_POOL_SIZE,
        maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 30000,
      });

      cached.conn = conn;
      console.log("✅ [connectDB] MongoDB connected successfully");
      logger.info("✅ [connectDB] MongoDB connected successfully");

      // Log connection state after connect
      console.log(`✅ [connectDB] Mongoose connection state AFTER connect(): ${mongoose.connection.readyState}`);
      logger.info("Successful connection to MongoDB.");
      
      break;
    } catch (error: any) {
      logger.error('Failed connection to MongoDB:', error);
      console.error("❌ [connectDB] Failed to connect to MongoDB:", error);
      console.error(`❌ [connectDB] Connection attempt ${attempt} failed:`, error);

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt;
        console.log(`⏳ [connectDB] Retrying in ${delay / 1000}s...`);
        await sleep(delay);
      } else {
        console.error("🚨 [connectDB] All retry attempts failed.");
        logger.error("🚨 [connectDB] All retry attempts failed.");
        throw error;
      }
    }
  }

  // Add event listeners only once (avoid duplicate listeners in serverless)
  if (mongoose.connection.listeners("connected").length === 0) {
    mongoose.connection.on("connected", () => {
      console.log("✅ [connectDB] Mongoose connected event fired");
    });
    mongoose.connection.on("error", (err) => {
      console.error("❌ [connectDB] Mongoose connection error event fired:", err);
    });
    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ [connectDB] Mongoose disconnected event fired");
    });
  }

  return conn!;
};
