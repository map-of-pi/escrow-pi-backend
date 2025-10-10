import { ClientSession } from "mongoose";
import { Order } from "../models/Order";
import logger from "../config/loggingConfig";
import { Comment } from "../models/Comment";
import { IUser } from "../types";

export const addComment = async (
  order_no: string, 
  description: string, 
  author: string,
  session?: ClientSession
) => {
  logger.info(`Adding comment to order ${order_no}`);
  try {
    const order = await Order.findOne({order_no}).session(session || null).lean();
    if (!order) throw new Error("Order not found");

    const newComment = new Comment({
      description,
      order_no: order.order_no,
      order_id: order._id,
      author
    });

    const comment = await newComment.save({ session });
    return comment;
  } catch (error: any) {
    logger.error("Error in addComment", { error: error.message, stack: error.stack });
    throw error;
  }
};

export const getOrderComments = async (order_no: string) => {
  logger.info(`Loading comment for order: ${order_no}`);
  try {
    const comments = await Comment.find({order_no}).lean();
    if (!comments) throw new Error("Comments not found");

    return comments;
  } catch (error: any) {
    logger.error("Error in addComment", { error: error.message, stack: error.stack });
    throw error;
  }
};