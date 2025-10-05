import { NextFunction, Request, Response } from "express";

import logger from '../config/loggingConfig';
import { OrderTypeEnum } from "../models/enums/orderTypeEnum";
import { validateUsername } from "../services/user.service";


export const validateUserFlow = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {

    try {
      logger.info('Validating user flow for order creation');
      const orderType = req.body.orderType
      if (!orderType || !Object.values(OrderTypeEnum).includes(orderType)) {
        return res.status(400).json({ message: "Invalid or missing orderType" });
      }

      const username = req.body.username;
      if (!username) {
        return res.status(400).json({ message: "Username is required for Request type" });
      }

      const validatedUser = await validateUsername(username);
      if (!validatedUser) {
        // logger.warn(`Invalid username format: ${username}`);
        return res.status(404).json({ message: "Sender not found" });
      }

      if (orderType === OrderTypeEnum.Request) {  
        req.body.sender = validatedUser;
        req.body.receiver = req.currentUser;

      } else {
        req.body.sender = req.currentUser;
        req.body.receiver = validatedUser
        // logger.info(`Validated user for username ${username}: ${validatedUser}`);
      }

      // logger.info(`Processing order info: ${JSON.stringify(req.body)}`);
      return next();

    } catch (error) {
      logger.error('Failed to resolve user-order flow', error);
      res.status(500).json({ message: 'Failed to identify | pioneer not found; please try again later'});
    }
  };
  