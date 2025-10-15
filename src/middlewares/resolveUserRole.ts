import { NextFunction, Request, Response } from "express";

import { logInfo, logWarn, logError } from "../config/loggingConfig";
import { OrderTypeEnum } from "../models/enums/orderTypeEnum";
import { validateUsername } from "../services/user.service";


export const validateUserFlow = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {

    try {
      const orderType = req.body.orderType
      if (!orderType || !Object.values(OrderTypeEnum).includes(orderType)) {
        logWarn(`Invalid or missing orderType: ${orderType}`);
        return res.status(400).json({ message: "Invalid or missing orderType" });
      }

      const username = req.body.username;
      if (!username) {
        logWarn(`Missing username for orderType ${orderType}`);
        return res.status(400).json({ message: "Username is required for Request type" });
      }

      const validatedUser = await validateUsername(username);
      if (!validatedUser) {
        logWarn(`Sender not found for username: ${username}`);
        return res.status(404).json({ message: "Sender not found" });
      }

      if (orderType === OrderTypeEnum.Request) {  
        req.body.sender = validatedUser;
        req.body.receiver = req.currentUser;

      } else {
        req.body.sender = req.currentUser;
        req.body.receiver = validatedUser
      }

      logInfo(`User flow validated: sender=${req.body.sender?.pi_uid}, receiver=${req.body.receiver?.pi_uid}, orderType=${orderType}`);
      next();
    } catch (err: any) {
      logError('Failed to validate user flow', err);
      res.status(500).json({ message: 'Failed to validate user flow; please try again later'});
    }
  };
