import dotenv from "dotenv";

import "./config/sentryConnection"; // initializes Sentry

import { connectDB } from "./config/dbConnection";
import app from "./utils/app";
import { env } from "./utils/env";

const PORT = env.PORT;

dotenv.config();

// Immediately invoke persistent connection
let dbConnected = false;

const startServer = async () => {
  console.log("Initiating server setup.");
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
        app.listen(PORT, () => {
          console.log(`Server is running on port ${PORT}`);
          resolve();
        });
      });
    }
    
    console.log("Server setup initiated.");
  } catch (err) {
    console.error('Server failed to initialize:', err);
  }
};

// Start the server setup process
startServer();

export default app;