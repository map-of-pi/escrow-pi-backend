import { ClientSession } from "mongoose";
import logger from "../config/loggingConfig";
import { nextOrderNo } from "../helpers/getNextOrderNo";
import { Comment } from "../models/Comment";
import { Order, OrderType } from "../models/Order";
import { IUser } from "../types";

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

export async function createOrderSecure(
  payload: { sender: IUser; receiver: IUser; amount: number; comment?: string },
  maxRetries = 3
): Promise<OrderType> {
  logger.info(`Starting secure order creation for`);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = await Order.startSession();
    try {
      session.startTransaction();

      logger.info(`Creating order attempt ${attempt} for ${payload.sender.pi_username} to ${payload.receiver.pi_username} amount: ${payload.amount}`);
      const orderNo = await nextOrderNo(session);
      logger.info(`Attempt ${attempt}: Generated order number ${orderNo}`);

      // ✅ explicitly create doc instance
      const newOrder = new Order({
        sender_id: payload.sender._id,
        sender_username: payload.sender.pi_username,
        receiver_id: payload.receiver._id,
        receiver_username: payload.receiver.pi_username,
        amount: payload.amount,
        order_no: orderNo
      });

      const order = await newOrder.save({ session });

      if (order && payload.comment?.trim()) {
        await addComment(order._id.toString(), payload.comment, session);
        logger.info(`Added comment to order ${order.order_no}`);
      }

      await session.commitTransaction();
      session.endSession();

      return order;

    } catch (err: any) {
      await session.abortTransaction().catch(() => {});
      session.endSession();

      if (err?.code === 11000 && attempt < maxRetries) continue;
      throw err;
    }
  }

  throw new Error("Failed to create order service after retries");
}
