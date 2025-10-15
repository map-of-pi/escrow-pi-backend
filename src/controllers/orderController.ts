import { Request, Response } from "express";
import { logInfo, logWarn, logError } from "../config/loggingConfig";
import { OrderStatusEnum } from "../models/enums/orderStatusEnum";
import { 
  createOrderSecure, 
  getUserOrders, 
  getUserSingleOrder, 
  updateOrder 
} from "../services/order.service";
import { IUser } from "../types";

export const createOrder = async (req: Request, res: Response) => {
  try {
    const authUser = req.currentUser as IUser
    const { sender, receiver, amount, comment } = req.body;
    
    if (!sender || !receiver || amount<=0) {
      logWarn(`Missing required fields to create order or invalid amount from user ${authUser?.pi_uid || "unknown"}`);
      return res.status(400).json({ message: "Missing required fields" });
    } 

    // Assume createOrderSecure is a function that creates an order securely
    const order_no = await createOrderSecure({ sender, receiver, amount, comment, authUser});
    logInfo(`Order created successfully by ${authUser.pi_uid} for order_no #${order_no}) for amount ${amount}`);
    return res.status(200).json(order_no);
  } catch (err: any) {
    logError(`Error creating order: ${err.message}`);
    return res.status(500).json({ message: 'An error occurred while creating order; please try again later' });
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
      [
        OrderStatusEnum.Requested,
        OrderStatusEnum.Initiated,
        OrderStatusEnum.Expired,
        OrderStatusEnum.Paid
      ].includes(status as OrderStatusEnum)
    ) {
      logWarn(`Invalid status: (${status}) or missing orderNo from user ${authUser?.pi_uid || "unknown"}`);
      return res.status(400).json({
        message: "Invalid status. Only disputed, declined, released or fulfilled are allowed.",
      });
    }

    const result = await updateOrder(orderNo, status, authUser);
    logInfo(`Order ${orderNo} updated to status ${status} by ${authUser.pi_uid}`);
    return res.status(200).json(result);
  } catch (err: any) {
    logError(`Error updating order #${req.params.orderNo}: ${err.message}`);
    return res.status(500).json({ message: 'An error occurred while updating order status; please try again later' });
  }
};

export const confirmRequestOrder = async (req: Request, res: Response) => {
  try {
    const {orderNo} = req.params;
    const authUser = req.currentUser as IUser;

    if (!orderNo) {
      logWarn(`Missing order number to confirm request order from user ${authUser?.pi_uid || "unknown"}`);
      return res.status(400).json({message: "order number cannot be empty"});
    }

    const result = await updateOrder(orderNo, OrderStatusEnum.Requested, authUser );
    logInfo(`Order #${orderNo} confirmed as requested by ${authUser.pi_uid}`);

    return res.status(200).json(result.order.order_no);
  } catch (err: any) {
    logError(`Error confirming order ${req.params.orderNo}: ${err.message}`);
    return res.status(500).json({ message: 'An error occurred while confirming request order; please try again later' });
  }
};

export const fetchSingleUserOrders = async (req: Request, res: Response) => {
  try {
    const authUser = req.currentUser as IUser;
    const userOrders = await getUserOrders(authUser);

    return res.status(200).json(userOrders);
  } catch (err: any) {
    logError(`Error fetching orders for current user ${req.currentUser?.pi_uid}: ${err.message}`);
    return res.status(500).json({ message: 'An error occurred while fetching current user order; please try again later' });
  }
};

export const fetchSingleOrder = async (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;

    if (!orderNo) {
      logWarn("Missing order number in request parameters.");
      return res.status(400).json({message: "order number can not empty"});
    }

    const result = await getUserSingleOrder(orderNo);

    if (!result) {
      logWarn(`Order not found with orderNo #${orderNo})`);
      return res.status(404).json({ message: "Order not found" });
    }
    logInfo(`Order retrieved successfully for orderNo #${orderNo}`);
    return res.status(200).json(result);
  } catch (err: any) {
    logError(`Error retrieving single user order for orderNo #${req.params.orderNo}: ${err.message}`);
    return res.status(500).json({ message: 'An error occurred while retrieving single user order; please try again later' });
  }
};