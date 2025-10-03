import User from "../models/User";
import logger from "../config/loggingConfig";
import { IUser } from "../types";

import mongoose from "mongoose";

const findOrCreateUser = async (currentUser: IUser): Promise<IUser> => {
  console.log(">>> [findOrCreateUser] Called with currentUser:", currentUser);

  const connectionStates = ["disconnected", "connected", "connecting", "disconnecting"];
  console.log(">>> [findOrCreateUser] Mongoose connection state:", mongoose.connection.readyState, "-", connectionStates[mongoose.connection.readyState]);
  try {
    console.log(`>>> [findOrCreateUser] Searching for existing user: pi_uid=${currentUser.pi_uid}, pi_username=${currentUser.pi_username}`);
    const existingUser = await User.findOne({
      pi_uid: currentUser.pi_uid,
      pi_username: currentUser.pi_username
    }).setOptions({ 
      readPreference: 'primary' 
    }).exec();

    console.log(">>> [findOrCreateUser] findOne result:", existingUser);

    if (existingUser) {
      console.log(`>>> [findOrCreateUser] Existing user found: ${existingUser.pi_uid}`);
      return existingUser;
    }

    console.log(">>> [findOrCreateUser] No existing user found. Creating new user...");
    const newUser = await User.create({
      pi_uid: currentUser.pi_uid,
      pi_username: currentUser.pi_username,
      user_name: currentUser.user_name
    });

    console.log(">>> [findOrCreateUser] New user created:", newUser);
    return newUser;

  } catch (error) {
    console.error(">>> [findOrCreateUser] Error during findOrCreateUser:", error);
    throw error;
  }
};

export const authenticate = async (
  currentUser: IUser
): Promise<IUser> => {
  console.log(">>> [userService.authenticate] Called with currentUser:", currentUser);

  if (!currentUser || !currentUser.pi_uid) {
    console.warn(">>> [userService.authenticate] Invalid user object passed:", currentUser);
  }
  try {
    console.log(">>> [userService.authenticate] Calling findOrCreateUser...");
    const user = await findOrCreateUser(currentUser);
    console.log(">>> [userService.authenticate] findOrCreateUser result:", user);

    if (!user) {
      console.warn(`>>> [userService.authenticate] No user returned from findOrCreateUser for: ${JSON.stringify(currentUser)}`);
      throw new Error("User not found or could not be created");
    }
    console.log(`>>> [userService.authenticate] Authentication successful for user: ${user.pi_uid}`);
    return user
  } catch (error) {
    console.error(">>> [userService.authenticate] Error during authentication:", error);
    logger.error(`Failed to authenticate user: ${ error }`);
    throw error;
  }
};

export const getUser = async (pi_uid: string): Promise<IUser | null> => {
  try {
    const user = await User.findOne({ pi_uid }).exec();
    return user ? user as IUser : null;
  } catch (error) {
    logger.error(`Failed to retrieve user for piUID ${ pi_uid }: ${ error }`);
    throw error;
  }
};

export const deleteUser = async (pi_uid: string | undefined): Promise<{ user: IUser | null }> => {
  try {
    // delete the user
    const deletedUser = await User.findOneAndDelete({ pi_uid }).exec();
    return {
      user: deletedUser ? deletedUser as IUser : null
    }
  } catch (error) {
    logger.error(`Failed to delete user or user association for piUID ${ pi_uid }: ${ error }`);
    throw error;
  }
};