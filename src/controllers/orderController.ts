import { Request, Response } from "express";
import { createOrderSecure, getUserOrders, getUserSingleOrder, updateOrder } from "../services/order.service";
import logger from "../config/loggingConfig";
import { IUser } from "../types";
import { OrderStatusEnum } from "../models/enums/orderStatusEnum";

export const createOrder = async (req: Request, res: Response) => {
  try {
    const authUser = req.currentUser as IUser
    // logger.info(`Processing order info: ${JSON.stringify(req.body)}`);
    const { sender, receiver, amount, comment } = req.body;
    if (!sender || !receiver || amount<=0) {
      logger.warn('Missing required fields in order creation request');
      return res.status(400).json({ message: "Missing required fields" });
    } 

    logger.info(`${sender.pi_username} is creating an order to ${receiver.pi_username} for amount: ${amount}`);
    
    // Assume createOrderSecure is a function that creates an order securely
    const order_no = await createOrderSecure({ sender, receiver, amount, comment, authUser});
    logger.info(`Order created successfully with order number: ${order_no}`);

    return res.status(200).json(order_no);
  } catch (error) {
    logger.error("Controller Error creating order:", {error});
    return res.status(500).json({ message: "Internal server error", error });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const {orderNo} = req.params;
    const {status} = req.body;
    const authUser = req.currentUser as IUser

    if (
      !orderNo ||
      !status ||
      ![
        OrderStatusEnum.Disputed,
        OrderStatusEnum.Declined,
        OrderStatusEnum.Fulfilled
      ].includes(status as OrderStatusEnum)
    ) {
      return res.status(400).json({
        message: "Invalid status. Only disputed, declined, or fulfilled are allowed.",
      });
    }

    const result = await updateOrder(orderNo, status, authUser);
    logger.info(`Order updated successfully with order number: ${result.order?.order_no}`);

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Controller Error creating order:", {error});
    return res.status(500).json({ message: "Internal server error", error });
  }
};

export const confirmRequestOrder = async (req: Request, res: Response) => {
  try {
    const {orderNo} = req.params;
    const authUser = req.currentUser as IUser;

    if (!orderNo) {
      return res.status(400).json({message: "order number can not be empty"});
    }

    const result = await updateOrder(orderNo, OrderStatusEnum.Requested, authUser );
    logger.info(`Order updated successfully with order number: ${result.order.order_no}`);

    return res.status(200).json(result.order.order_no);
  } catch (error) {
    logger.error("Controller Error creating order:", {error});
    return res.status(500).json({ message: "Internal server error", error });
  }
};

export const fetchSingleUserOrders = async (req: Request, res: Response) => {
  try {
    const authUser = req.currentUser as IUser;

    const userOrders = await getUserOrders(authUser);
    logger.info(`${userOrders.length} Order fetched successfully for user: ${authUser.pi_username}`);

    return res.status(200).json(userOrders);
  } catch (error) {
    logger.error("Controller Error fetching all user's orders:", {error});
    return res.status(500).json({ message: "Internal server error", error });
  }
};

export const fetchSingleOrder = async (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;

    if (!orderNo) {
      return res.status(400).json({message: "order number can not empty"});
    }

    const result = await getUserSingleOrder(orderNo);
    logger.info(`Order fetched successfully with order number: ${result.order.order_no}`);
    return res.status(200).json(result);
  } catch (error) {
    logger.error("Controller Error fetching order:", {error});
    return res.status(500).json({ message: "Internal server error", error });
  }
};