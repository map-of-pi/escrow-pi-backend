import mongoose from "mongoose";
import logger from "./loggingConfig";
import { env } from "../utils/env";

let cached: { conn: typeof mongoose | null } = { conn: null };

export const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }
  
  try {
    // Only log the MongoDB URL in non-production environments
    if (env.NODE_ENV === 'development') {
      logger.info(`Connecting to MongoDB with URL: ${env.MONGODB_URL}`);
      console.log(`🟢 [connectDB] MongoDB URL: ${env.MONGODB_URL}`);
    }

    const conn = await mongoose.connect(env.MONGODB_URL, {
      minPoolSize: env.MONGODB_MIN_POOL_SIZE,
      maxPoolSize: env.MONGODB_MAX_POOL_SIZE
    });
    cached.conn = conn;

    return conn;
  } catch (error) {
    logger.error('Failed connection to MongoDB:', error);
    throw error;
  }
};