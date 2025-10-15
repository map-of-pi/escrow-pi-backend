import { ClientSession } from "mongoose";
import { logInfo, logWarn, logError } from "../config/loggingConfig";
import { Comment } from "../models/Comment";
import { Order } from "../models/Order";

export const addComment = async (
  order_no: string, 
  description: string, 
  author: string,
  session?: ClientSession
) => {
  try {
    const order = await Order.findOne({order_no}).session(session || null).lean();
    if (!order) {
      logWarn(`Attempted to add comment to non-existent order #${order_no}`);
      throw new Error("Order not found");
    }

    const newComment = new Comment({
      description,
      order_no: order.order_no,
      order_id: order._id,
      author
    });

    const comment = await newComment.save({ session });
    logInfo(`New comment added by ${author} to order #${order_no}`);
    return comment;
  } catch (err: any) {
    logError(`Failed to add comment to order #${order_no}`, err);
    throw err;
  }
};

export const getOrderComments = async (order_no: string) => {
  try {
    const comments = await Comment.find({order_no}).lean();
    if (!comments) {
      logWarn(`No comments found for order #${order_no}`);
      throw new Error("Comments not found");
    }

    logInfo(`Fetched ${comments.length} comment(s) for order #${order_no}`);
    return comments;
  } catch (err: any) {
    logError(`Failed to fetch comments for order #${order_no}`, err);
    throw err;
  }
};