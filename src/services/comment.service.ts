import { ClientSession } from "mongoose";
import { Order } from "../models/Order";
import logger from "../config/loggingConfig";
import { Comment } from "../models/Comment";

export const addComment = async (
  orderId: string, 
  description: string, 
  session?: ClientSession
) => {
  logger.info(`Adding comment to order ${orderId}`);
  try {
    const order = await Order.findById(orderId).session(session || null);
    if (!order) throw new Error("Order not found");

    const newComment = new Comment({
      description,
      order_no: order.order_no,
      order_id: order._id
    });

    const comment = await newComment.save({ session });
    return comment;
  } catch (error: any) {
    logger.error("Error in addComment", { error: error.message, stack: error.stack });
    throw error;
  }
};