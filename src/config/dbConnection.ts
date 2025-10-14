import mongoose from "mongoose";
import logger from "./loggingConfig";
import { env } from "../utils/env";

// Retry configuration
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 2000;

// Global cached connection
const globalWithMongoose = global as typeof globalThis & {
  mongooseConn?: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
};

if (!globalWithMongoose.mongooseConn) {
  globalWithMongoose.mongooseConn = { conn: null, promise: null };
}
const cached = globalWithMongoose.mongooseConn;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const connectDB = async (): Promise<typeof mongoose> => {
  if (cached.conn) {
    logger.info("✅ [connectDB] Using cached MongoDB connection");
    console.log("✅ [connectDB] Using cached MongoDB connection");
    return cached.conn;
  }

  if (cached.promise) {
    logger.info("⏳ [connectDB] Awaiting existing MongoDB connection promise");
    return cached.promise;
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
  let conn: typeof mongoose;
  
  while (attempt < MAX_RETRIES) {
    attempt++;

    try {
      console.log(`🟢 [connectDB] Attempt ${attempt} to connect to MongoDB...`);

      conn = await mongoose.connect(env.MONGODB_URL, {
        minPoolSize: env.MONGODB_MIN_POOL_SIZE,
        maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
        serverSelectionTimeoutMS: 60000,
        socketTimeoutMS: 60000,
      });

      cached.conn = conn;
      cached.promise = null;

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
        const delay = Math.min(RETRY_DELAY_MS * Math.pow(2, attempt), 30000);
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
  if (mongoose.connection.listenerCount("connected") === 0) {
    mongoose.connection.on("connected", () => {
      console.log("✅ [connectDB] Mongoose connected event fired");
    });
    mongoose.connection.on("error", (err) => {
      console.error("❌ [connectDB] Mongoose connection error event fired:", err);
    });
    mongoose.connection.on("disconnected", async () => {
      console.warn("⚠️ [connectDB] Mongoose disconnected event fired");
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`🔄 [connectDB] Reconnecting attempt ${attempt}...`);
          await mongoose.connect(env.MONGODB_URL);
          console.log("✅ [connectDB] Reconnected to MongoDB successfully");
          return;
        } catch (reconnectErr) {
          console.error(`❌ [connectDB] Reconnect attempt ${attempt} failed`, reconnectErr);
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
      console.error("🚨 [connectDB] Failed to reconnect after multiple attempts.");
    });
  }

  return conn!;
};
