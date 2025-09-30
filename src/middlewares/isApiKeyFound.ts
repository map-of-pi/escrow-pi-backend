import { NextFunction, Request, Response } from "express";

import { platformAPIClient } from "../config/platformAPIclient";
import logger from '../config/loggingConfig';
import ApiKey from "../models/ApiKey";

export const isApiKeyFound = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const authUser = req.currentUser;  

    try {
      const existingKey = await ApiKey.findOne({ dev_pi_uid: authUser?.pi_uid, status: "active" });
      if (existingKey) {
        logger.warn(`Developer ${authUser?.pi_uid} already has an active API key.`);
        return res.status(400).json({ message: "You already have an active API key. Please revoke it before creating a new one." });
      };
      return next();

    } catch (error) {
      logger.error('failed to check for existing API key:', error);
      res.status(500).json({ message: 'failed to check for existing API key'});
    }
  };
  