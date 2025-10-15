import mongoose from "mongoose";
import { logInfo, logWarn, logError } from "../config/loggingConfig";
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
    logInfo("Using cached MongoDB connection.");
    return cached.conn;
  }

  if (cached.promise) {
    logInfo("MongoDB connection in progress, awaiting existing promise.");
    return cached.promise;
  }

  // Set global buffering timeout before connecting
  mongoose.set("bufferTimeoutMS", 60000);

  let attempt = 0;
  let conn: typeof mongoose;

  logInfo("Attempting to connect to MongoDB..");
  
  while (attempt < MAX_RETRIES) {
    attempt++;

    try {
      conn = await mongoose.connect(env.MONGODB_URL, {
        minPoolSize: env.MONGODB_MIN_POOL_SIZE,
        maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
        serverSelectionTimeoutMS: 60000,
        socketTimeoutMS: 60000,
      });

      cached.conn = conn;
      cached.promise = null;
      logInfo(`MongoDB connected successfully on attempt #${attempt}.`);
      break;
    } catch (err: any) {
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(RETRY_DELAY_MS * Math.pow(2, attempt), 30000);
        logWarn(`MongoDB connection attempt #${attempt} failed. Retrying in ${delay}ms..`);
        await sleep(delay);
      } else {
        logError(`MongoDB connection failed after #${attempt} attempts: ${err.message}`);
        throw err;
      }
    }
  }

  // Add event listeners only once (avoid duplicate listeners in serverless)
  if (mongoose.connection.listenerCount("connected") === 0) {
    mongoose.connection.on("connected", () => logInfo("MongoDB connection established."));
    mongoose.connection.on("disconnected", async () => {
      logWarn("MongoDB disconnected. Attempting to reconnect..");
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await mongoose.connect(env.MONGODB_URL);
          logInfo("MongoDB reconnected successfully.");
          return;
        } catch (err: any) {
          logWarn(`Reconnection attempt #${attempt} failed: ${err.message}`);
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
      logError("Failed to reconnect to MongoDB after multiple attempts.");
    });
    mongoose.connection.on("error", (err) => logError(`MongoDB error: ${err.message}`));
  }

  return conn!;
};
