import { Request, Response } from "express";
import { addComment, getOrderComments } from "../services/comment.service";
import { logInfo, logWarn, logError } from "../config/loggingConfig";
import { IUser } from "../types";

export const addNewComment = async (req: Request, res: Response) => {
  try {
    const authUser = req.currentUser as IUser
    const { order_no, description } = req.body;
    if (!order_no || !description.trim()) {
      logWarn("Missing required fields (order_no or description).");
      return res.status(400).json({ message: "Missing required fields" });
    } 
    
    const newComment = await addComment( order_no, description, authUser.pi_username );
    logInfo(`Comment added successfully for order ${order_no} by ${authUser.pi_username}`);
    return res.status(200).json(newComment);
  } catch (err: any) {
    logError(`Error adding comment: ${err.message}`);
    return res.status(500).json({ message: 'An error occurred while adding new comment; please try again later' });
  }
};

export const fetchOrderComment = async (req: Request, res: Response) => {
  const {order_no} = req.params;

  if (!order_no) {
    logWarn("Missing order_no parameter.");
    return res.status(400).json({ message: "Missing order number" });
  }

  try {
    const comments = await getOrderComments(order_no);

    if (!comments || comments.length === 0) {
      logWarn(`No comments found for order #${order_no}`);
    } else {
      logInfo(`Retrieved ${comments.length} comment(s) for order #${order_no}`);
    }

    return res.status(200).json(comments);
  } catch (err: any) {
    logError(`Error fetching comments for order #${order_no}: ${err.message}`);
    return res.status(500).json({ message: 'An error occurred while fetching order comments; please try again later' });
  }
};