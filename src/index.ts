import dotenv from "dotenv";

import { connectDB } from "./config/dbConnection";
import logger from "./config/loggingConfig";
import "./config/sentryConnection";
import app from "./utils/app";
import { env } from "./utils/env";

dotenv.config();

// Immediately invoke persistent connection
let dbConnected = false;

const startServer = async () => {
  console.log("🟢 [index.ts] Starting server initialization...");
  logger.info("Initiating server setup...");
  try {
    if (!dbConnected) {
      // Establish connection to MongoDB
      await connectDB();
      dbConnected = true;
    } else {
    }

    // In a non-serverless environment, start the server
    if (env.NODE_ENV === 'development') {
      await new Promise<void>((resolve) => {
        // Start listening on the specified port
        app.listen(env.PORT, () => {
          console.log(`✅ [index.ts] Server listening on port ${env.PORT}`);
          logger.info(`Server is running on port ${env.PORT}`);
          resolve();
        });
      });
    }
    
    logger.info("Server setup initiated.");
  } catch (error) {
    console.error("❌ [index.ts] Server failed to initialize:", error);
    logger.error('Server failed to initialize:', error);
  }
};

// Start the server setup process
startServer();

export default app;