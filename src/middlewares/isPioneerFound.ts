import { NextFunction, Request, Response } from "express";

import { platformAPIClient } from "../config/platformAPIclient";
import logger from '../config/loggingConfig';

export const isPioneerFound = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader && authHeader.split(" ")[1];

    if (!tokenFromHeader) {
      console.warn(">>> [isPioneerFound] No Authorization token provided.");
      return res.status(401).json({ message: "Missing Authorization token" });
    }

    console.log(">>> [isPioneerFound] Token extracted from header:", tokenFromHeader);

    try {
      // Verify the user's access token with the /me endpoint:
      const me = await platformAPIClient.get(`/v2/me`, { 
        headers: { 'Authorization': `Bearer ${ tokenFromHeader }` }  
      });

      console.log(">>> [isPioneerFound] Response from /v2/me:", me.data);

      if (me && me.data) {
        const user = {
          pi_uid: me.data.uid,
          pi_username: me.data.username,
          user_name: me.data.username
        }
        req.body.user = user;
        console.log(`>>> [isPioneerFound] Pioneer found: ${user.pi_uid} - ${user.pi_username}`);
        logger.info(`Pioneer found: ${user.pi_uid} - ${user.pi_username}`);
        return next();
      } else {
        logger.warn("Pioneer not found.");
        console.warn(">>> [isPioneerFound] Pioneer not found in /v2/me response.");
        return res.status(404).json({message: "Pioneer not found"});
      }
    } catch (error) {
      console.error(">>> [isPioneerFound] Failed to identify pioneer:", error);
      logger.error('Failed to identify pioneer:', error);
      res.status(500).json({ message: 'Failed to identify | pioneer not found; please try again later'});
    }
  };
  