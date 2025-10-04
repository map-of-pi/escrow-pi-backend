import { Request, Response } from "express";
import { createOrderSecure, getUserOrders, getUserSingleOrder } from "../services/order.service";
import logger from "../config/loggingConfig";
import { IUser } from "../types";

export const createOrder = async (req: Request, res: Response) => {
  try {
    // logger.info(`Processing order info: ${JSON.stringify(req.body)}`);
    const { sender, receiver, amount, comment } = req.body;
    if (!sender || !receiver || amount<=0) {
      logger.warn('Missing required fields in order creation request');
      return res.status(400).json({ message: "Missing required fields" });
    } 

    logger.info(`${sender.pi_username} is creating an order to ${receiver.pi_username} for amount: ${amount}`);
    
    // Assume createOrderSecure is a function that creates an order securely
    const order_no = await createOrderSecure({ sender, receiver, amount, comment });
    logger.info(`Order created successfully with order number: ${order_no}`);

    return res.status(200).json(order_no);
  } catch (error) {
    logger.error("Controller Error creating order:", {error});
    return res.status(500).json({ message: "Internal server error", error });
  }
};

export const fetchSingleUserOrders = async (req: Request, res: Response) => {
  try {
    const authUser = req.currentUser as IUser;

    const userOrders = await getUserOrders(authUser);
    logger.info(`Order created successfully with order number: ${userOrders.length}`);

    return res.status(200).json(userOrders);
  } catch (error) {
    logger.error("Controller Error creating order:", {error});
    return res.status(500).json({ message: "Internal server error", error });
  }
};

export const fetchSingleOrder = async (req: Request, res: Response) => {
  try {
    const orderNo = req.params.orderNo as string;

    const order = await getUserSingleOrder(orderNo);
    logger.info(`Order created successfully with order number: ${order}`);

    return res.status(200).json(order);
  } catch (error) {
    logger.error("Controller Error creating order:", {error});
    return res.status(500).json({ message: "Internal server error", error });
  }
};