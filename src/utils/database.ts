import mongoose from "mongoose";
import { connectDB } from "../config/dbConnection";
import { logInfo, logWarn } from "../config/loggingConfig";

export const verifyDbConnection = async () => {
  const readyState = mongoose.connection.readyState;

  // 0 = disconnected | 1 = connected | 2 = connecting | 3 = disconnecting
  if (readyState === 1) {
    logInfo("MongoDB connection is already sustained");
    return;
  }

  if (readyState === 2) {
    logInfo("MongoDB connection is in progress; waiting..");
    return; // Let existing connection finish
  }

  logWarn("MongoDB not connected; re-establishing connection..");
  await connectDB();
  logInfo("MongoDB connection established.");
};