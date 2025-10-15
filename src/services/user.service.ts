import mongoose from "mongoose";

import { logInfo, logWarn, logError } from "../config/loggingConfig";
import User from "../models/User";
import { IUser } from "../types";
import { verifyDbConnection } from "../utils/database";

const findOrCreateUser = async (currentUser: IUser): Promise<IUser> => {
  try {

    if (!currentUser?.pi_uid || !currentUser?.pi_username) {
      throw new Error("Invalid currentUser data; missing pi_uid or pi_username");
    }

    logInfo(`Looking up user with UID: ${currentUser.pi_uid}, Username: ${currentUser.pi_username}`);

    const existingUser = await User.findOne({
      pi_uid: currentUser.pi_uid,
      pi_username: currentUser.pi_username
    }).setOptions({ 
      readPreference: 'primary' 
    }).exec();

    if (existingUser) {
      logInfo(`User found: ${existingUser.pi_username} | ${existingUser.pi_uid}`);
      return existingUser;
    }

    logInfo(`User not found; creating new record for UID: ${currentUser.pi_uid}`);

    const newUser = await User.create({
      pi_uid: currentUser.pi_uid,
      pi_username: currentUser.pi_username,
      user_name: currentUser.user_name
    });

    logInfo(`New user created successfully: ${newUser.pi_username} | (${newUser.pi_uid})`);
    return newUser;
  } catch (err: any) {
    logError(`Failed to find or create new user for UID: ${currentUser?.pi_uid || "unknown"}: ${err.message}`);
    throw err;
  }
};

export const authenticate = async (
  currentUser: IUser
): Promise<IUser> => {

  if (!currentUser || !currentUser.pi_uid) {
    throw new Error("Invalid user data received during authentication");
  }

  logInfo(`Authenticating user with UID: ${currentUser.pi_uid}`);

  try {
    await verifyDbConnection();

    const user = await findOrCreateUser(currentUser);

    if (!user) {
      throw new Error(`User not found or could not be created with UID: ${currentUser.pi_uid}`);
    }
    logInfo(`Authentication successful for user: ${user.pi_username} | (${user.pi_uid})`);
    return user;
  } catch (err: any) {
    logError(`Authentication failed for UID: ${currentUser?.pi_uid || "unknown"}: ${err.message}`);
    throw err;
  }
};

export const getUser = async (pi_uid: string): Promise<IUser | null> => {
  try {
    logInfo(`Fetching user by UID: ${pi_uid}`);
    const user = await User.findOne({ pi_uid }).exec();

    if (!user) {
      logWarn(`No user found with UID: ${pi_uid}`);
      return null;
    }

    logInfo(`User retrieved successfully: ${user.pi_username} | ${user.pi_uid}`);
    return user as IUser;
  } catch (err: any) {
    logError(`Failed to retrieve user by UID ${pi_uid}: ${err.message}`);
    throw err;
  }
};

export const validateUsername = async (pi_username: string): Promise<IUser | null> => {
  try {
    logInfo(`Validating username: ${pi_username}`);
    const user = await User.findOne({ pi_username }).lean();
    if (!user) throw new Error(`Failed to find user with ${pi_username}`);
    logInfo(`Username validation successful: ${pi_username} | UID: ${user.pi_uid}`);
    return user;
  } catch (err: any) {
    logError(`Failed to validate username ${pi_username}: ${err.message}`);
    throw err;
  }
};

export const deleteUser = async (pi_uid: string | undefined): Promise<{ user: IUser | null }> => {
  try {
    if (!pi_uid) {
      throw new Error("Missing pi_uid for user deletion");
    }

    logInfo(`Attempting to delete user with UID: ${pi_uid}`);
    // delete the user
    const deletedUser = await User.findOneAndDelete({ pi_uid }).exec();

    if (deletedUser) {
      logInfo(`User deleted successfully: ${deletedUser.pi_username} | ${deletedUser.pi_uid}`);
    } else {
      logWarn(`No user found to delete with UID: ${pi_uid}`);
    }
    return {
      user: deletedUser ? deletedUser as IUser : null
    }
  } catch (err: any) {
    logError(`Failed to delete user with UID ${pi_uid || "unknown"}: ${err.message}`);
    throw err;
  }
};