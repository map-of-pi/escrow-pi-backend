import jwt from "jsonwebtoken";

import { logInfo, logWarn, logError } from "../config/loggingConfig";
import User from "../models/User";
import { IUser } from "../types";
import { env } from "../utils/env";

export const generateUserToken = (user: IUser) => {
  try {
    const token = jwt.sign(
      { userId: user.pi_uid, _id: user._id }, 
      env.JWT_SECRET, 
      { expiresIn: "1d" } // 1 day
    );
    logInfo(`Generated JWT token for user: ${user.pi_uid}`);
    return token;
  } catch (err: any) {
    logError(`Failed to generate token for user ${user.pi_uid}: ${err.message}`);
    throw new Error('Failed to generate user token; please try again later.');
  }
};

export const decodeUserToken = async (token: string) => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    if (!decoded.userId) {
      logWarn("Invalid token: missing userId.");
      throw new Error("Invalid token: Missing userID.");
    }
    const user = await User.findOne({pi_uid: decoded.userId});
    if (!user) {
      logWarn(`User not found for decoded token userId: ${decoded.userId}`);
      throw new Error("User not found.");
    }
    logInfo(`Token successfully decoded for user: ${user.pi_uid}`);
    return user;
  } catch (err: any) {
    logError(`Failed to decode user token: ${err.message}`);
    throw new Error('Failed to decode user token; please try again later.');
  }
};
