import User from "../models/User";
import logger from "../config/loggingConfig";
import { IUser } from "../types";

import mongoose from "mongoose";

const findOrCreateUser = async (currentUser: IUser): Promise<IUser> => {

  const connectionStates = ["disconnected", "connected", "connecting", "disconnecting"];
  try {
    const existingUser = await User.findOne({
      pi_uid: currentUser.pi_uid,
      pi_username: currentUser.pi_username
    }).setOptions({ 
      readPreference: 'primary' 
    }).exec();

    if (existingUser) {
      return existingUser;
    }

    const newUser = await User.create({
      pi_uid: currentUser.pi_uid,
      pi_username: currentUser.pi_username,
      user_name: currentUser.user_name
    });

    return newUser;

  } catch (error) {
    throw error;
  }
};

export const authenticate = async (
  currentUser: IUser
): Promise<IUser> => {

  if (!currentUser || !currentUser.pi_uid) {
    logger.warn(">>> [userService.authenticate] Invalid user object passed:", currentUser);
  }
  try {
    const user = await findOrCreateUser(currentUser);
    if (!user) {
      throw new Error("User not found or could not be created");
    }
    return user
  } catch (error) {
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

export const validateUsername = async (pi_username: string): Promise<IUser | null> => {
  try {
    const user = await User.findOne({ pi_username }).lean();
    return user ? user as IUser : null;
  } catch (error) {
    logger.error(`Failed to validate username ${ pi_username }: ${ error }`);
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