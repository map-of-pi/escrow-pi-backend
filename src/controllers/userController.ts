import { Request, Response } from "express";

import { logInfo, logWarn, logError } from "../config/loggingConfig";
import * as jwtHelper from "../helpers/jwt";
import * as userService from "../services/user.service";
import { IUser } from "../types";

export const authenticateUser = async (req: Request, res: Response) => {
  const auth = req.body;

  if (!auth?.user) {
    logWarn("Missing user data in request body.");
    return res.status(400).json({ message: "Missing user data" });
  }

  try {
    const user = await userService.authenticate(auth.user);
    if (!user) {
      logWarn(`Invalid credentials for user: ${auth.user?.pi_uid || 'unknown'}`);
      return res.status(401).json({ message: "Invalid user credentials" });
    }
    const token = jwtHelper.generateUserToken(user);
    const expiresDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // 1 day

    logInfo(`User authenticated successfully: ${user.pi_uid}`);

    return res
      .cookie("token", token, {
        httpOnly: true, 
        expires: expiresDate, 
        secure: true, 
        priority: "high", 
        sameSite: "lax"
      }).status(200).json({ user: user, token });
  } catch (err: any) {
    logError(`Error authenticating user: ${err.message}`);
    return res.status(500).json({ message: 'An error occurred while authenticating user; please try again later' });
  }
};

export const autoLoginUser = async(req: Request, res: Response) => {
  const currentUser = req.currentUser as IUser;

  if (!currentUser) {
    logWarn("No currentUser found on request.");
    return res.status(401).json({ message: "User not logged in" });
  }

  try {
    logInfo(`User auto-logged in: ${currentUser.pi_uid}`);
    return res.status(200).json({ user: currentUser });
  } catch (err: any) {
    logError(`Error auto-logging user: ${err.message}`);
    return res.status(500).json({ message: 'An error occurred while auto-logging the user; please try again later' });
  }
};

export const getUser = async(req: Request, res: Response) => {
  const { pi_uid } = req.params;
  try {
    const currentUser: IUser | null = await userService.getUser(pi_uid);

    if (!currentUser) {
      logWarn(`User not found with pi_uid: ${pi_uid}`);
      return res.status(404).json({ message: "User not found" });
    }
    logInfo(`User retrieved successfully: ${pi_uid}`);
    return res.status(200).json(currentUser);
  } catch (err: any) {
    logError(`Error retrieving user ${pi_uid}: ${err.message}`);
    return res.status(500).json({ message: 'An error occurred while getting user; please try again later' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const currentUser = req.currentUser;

  if (!currentUser) {
    logWarn("No currentUser found on request.");
    return res.status(401).json({ message: "User not logged in" });
  }

  try {
    const deletedData = await userService.deleteUser(currentUser?.pi_uid);
    logInfo(`User deleted successfully: ${currentUser.pi_uid}`);
    return res.status(200).json({ message: "User deleted successfully", deletedData });
  } catch (err: any) {
    logError(`Error deleting user ${currentUser?.pi_uid}: ${err.message}`);
    return res.status(500).json({ message: 'An error occurred while deleting user; please try again later' });
  }
};
