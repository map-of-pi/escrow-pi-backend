import { Request, Response } from "express";
import { addComment, getOrderComments } from "../services/comment.service";
import logger from "../config/loggingConfig";
import { IUser } from "../types";

export const addNewComment = async (req: Request, res: Response) => {
  try {
    const authUser = req.currentUser as IUser
    // logger.info(`Processing order info: ${JSON.stringify(req.body)}`);
    const { order_no, description } = req.body;
    if (!order_no || !description.trim()) {
      logger.warn('Missing required fields in order creation request');
      return res.status(400).json({ message: "Missing required fields" });
    } 
    
    // Assume createOrderSecure is a function that creates an order securely
    const newComment = await addComment( order_no, description, authUser.pi_username );
    logger.info(`Comment created successfull:`);

    return res.status(200).json(newComment);
  } catch (error) {
    logger.error("Controller Error creating comment:", {error});
    return res.status(500).json({ message: "Internal server error", error });
  }
};

export const fetchOrderComment = async (req: Request, res: Response) => {
  try {
    const {order_no} = req.params

    const comments = await getOrderComments(order_no);
    logger.info(`${comments.length} Cooments fetched successfully for order: ${order_no}`);

    return res.status(200).json(comments);
  } catch (error) {
    logger.error("Controller Error fetching all user's orders:", {error});
    return res.status(500).json({ message: "Internal server error", error });
  }
};