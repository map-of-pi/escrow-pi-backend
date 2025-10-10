import { Request, Response } from "express";

import * as jwtHelper from "../helpers/jwt";
import * as userService from "../services/user.service";
import { IUser } from "../types";

import logger from '../config/loggingConfig';

export const authenticateUser = async (req: Request, res: Response) => {
  const auth = req.body;

  console.log(">>> [authenticateUser] Incoming request body:", auth);

  if (!auth?.user) {
    console.warn(">>> [authenticateUser] No user data provided in request body.");
    return res.status(400).json({ message: "Missing user data" });
  }

  try {
    console.log(">>> [authenticateUser] Calling userService.authenticate...");
    const user = await userService.authenticate(auth.user);
    console.log(">>> [authenticateUser] userService.authenticate result:", user);
    if (!user) {
      console.warn(`>>> [authenticateUser] Authentication failed for input: ${JSON.stringify(auth.user)}`);
      return res.status(401).json({ message: "Invalid user credentials" });
    }

    console.log(`>>> [authenticateUser] Generating JWT token for user: ${user.pi_uid}`);
    const token = jwtHelper.generateUserToken(user);

    const expiresDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // 1 day
    console.log(`>>> [authenticateUser] Cookie will expire: ${expiresDate.toISOString()}`);

    logger.info(`User authenticated: ${user.pi_uid}`);
    console.log(`>>> [authenticateUser] User authenticated successfully: ${user.pi_uid}`);

    return res.cookie("token", token, {httpOnly: true, expires: expiresDate, secure: true, priority: "high", sameSite: "lax"}).status(200).json({
      user: user,
      token,
    });
  } catch (error) {
    logger.error('Failed to authenticate user:', error);
    console.error(`>>> [authenticateUser] Failed to authenticate user with body ${JSON.stringify(auth)}:`, error);
    return res.status(500).json({ message: 'An error occurred while authenticating user; please try again later' });
  }
};

export const autoLoginUser = async(req: Request, res: Response) => {
  const currentUser = req.currentUser as IUser;
  try {
    console.log(">>> [autoLoginUser] Called. Current user from request:", currentUser);
    logger.info(`Auto-login successful for user: ${currentUser?.pi_uid || "NULL"}`);
    console.log(`>>> [autoLoginUser] Auto-login successful for user: ${currentUser?.pi_uid || "NULL"}`);
    return res.status(200).json({
      user: currentUser,
    });
  } catch (error) {
    console.error(`>>> [autoLoginUser] Failed to auto-login user for userID ${ currentUser?.pi_uid }:`, error);
    logger.error(`Failed to auto-login user for userID ${ req.currentUser?.pi_uid }:`, error);
    return res.status(500).json({ message: 'An error occurred while auto-logging the user; please try again later' });
  }
};

export const getUser = async(req: Request, res: Response) => {
  const { pi_uid } = req.params;
  try {
    const currentUser: IUser | null = await userService.getUser(pi_uid);
    if (!currentUser) {
      logger.warn(`User not found with PI_UID: ${pi_uid}`);
      return res.status(404).json({ message: "User not found" });
    }
    logger.info(`Fetched user with PI_UID: ${pi_uid}`);
    return res.status(200).json(currentUser);
  } catch (error) {
    logger.error(`Failed to fetch user for userID ${ pi_uid }:`, error);
    return res.status(500).json({ message: 'An error occurred while getting user; please try again later' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const currentUser = req.currentUser;
  try {
    const deletedData = await userService.deleteUser(currentUser?.pi_uid);
    logger.info(`Deleted user with PI_UID: ${currentUser?.pi_uid}`);
    return res.status(200).json({ message: "User deleted successfully", deletedData });
  } catch (error) {
    logger.error(`Failed to delete user for userID ${ currentUser?.pi_uid }:`, error);
    return res.status(500).json({ message: 'An error occurred while deleting user; please try again later' });
  }
};
