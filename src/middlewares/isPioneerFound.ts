import { NextFunction, Request, Response } from "express";

import { logInfo, logWarn, logError } from "../config/loggingConfig";
import { platformAPIClient } from "../config/platformAPIclient";

export const isPioneerFound = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader && authHeader.split(" ")[1];

  if (!tokenFromHeader) {
    logWarn("Missing Authorization token in header");
    return res.status(401).json({ message: "Missing Authorization token" });
  }

  try {
    logInfo("Verifying user access token with Pi Platform API...");
    // Verify the user's access token with the /me endpoint:
    const me = await platformAPIClient.get(`/v2/me`, { 
      headers: { 'Authorization': `Bearer ${ tokenFromHeader }` }  
    });

    if (me?.data) {
      const { uid, username } = me.data;

      const user = {
        pi_uid: uid,
        pi_username: username,
        user_name: username
      };

      req.body.user = user;
      logInfo(`Pioneer verified: ${username} (${uid})`);
      next();
    } else {
      logWarn("Pioneer not found in Pi Platform response");
      return res.status(404).json({message: "Pioneer not found"});
    }
  } catch (err: any) {
    logError("Failed to identify pioneer via Pi Platform API", err);
    res.status(500).json({ message: 'Failed to identify pioneer; please try again later'});
  }
};