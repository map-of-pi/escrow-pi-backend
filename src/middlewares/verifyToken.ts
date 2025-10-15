import { NextFunction, Request, Response } from "express";

import { logInfo, logWarn, logError } from "../config/loggingConfig";
import { decodeUserToken } from "../helpers/jwt";
import { IUser } from "../types";

declare module 'express-serve-static-core' {
  interface Request {
    currentUser?: IUser;
    token?: string;
  }
}

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // First, checking if the token exists in the cookies
  const tokenFromCookie = req.cookies.token;

  // Fallback to the authorization header if token is not in the cookie
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader && authHeader.split(" ")[1];

  // Prioritize token from cookies, then from header
  const token = tokenFromCookie || tokenFromHeader;

  if (!token) {
    logWarn('Unauthorized access attempt; missing token');
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Decode the token to get the user information
    const currentUser = await decodeUserToken(token);
    if (!currentUser) {
      logWarn('Unauthorized access attempt; invalid token');
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Attach currentUser to the request object
    req.currentUser = currentUser;
    req.token = token;
    logInfo(`Token verified successfully for user: ${currentUser.pi_uid}`);
    next();
  } catch (err: any) {
    logError('Failed to verify token', err);
    return res.status(500).json({ message: 'Failed to verify token; please try again later' });
  }
};

export const verifyAdminToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { ADMIN_API_USERNAME, ADMIN_API_PASSWORD } = process.env;
  const authHeader = req.headers.authorization;
  const base64Credentials = authHeader && authHeader.split(" ")[1];

  if (!base64Credentials) {
    logWarn('Unauthorized admin access attempt; missing token');
    return res.status(401).json({ message: "Unauthorized" });
  }

  const credentials = Buffer.from(base64Credentials, "base64").toString("ascii");
  const [username, password] = credentials.split(":");

  if (username !== ADMIN_API_USERNAME || password !== ADMIN_API_PASSWORD) {
    logWarn(`Unauthorized admin access attempt with username: ${username}`);
    return res.status(401).json({ message: "Unauthorized" });
  }
  logInfo(`Admin access granted for username: ${username}`);
  next();
};
