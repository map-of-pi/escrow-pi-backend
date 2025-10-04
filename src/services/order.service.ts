import { ClientSession } from "mongoose";
import logger from "../config/loggingConfig";
import { nextOrderNo } from "../helpers/getNextOrderNo";
import { Comment, CommenType } from "../models/Comment";
import { Order, OrderType } from "../models/Order";
import { IUser } from "../types";
import { error } from "winston";
import { OrderStatusEnum } from "../models/enums/orderStatusEnum";
import { addComment } from "./comment.service";

export async function createOrderSecure(
  payload: { sender: IUser; receiver: IUser; amount: number; comment?: string },
  maxRetries = 3
): Promise<string> {
  logger.info(`Starting secure order creation for`);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = await Order.startSession();
    try {
      session.startTransaction();

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

      return order.order_no;

    } catch (err: any) {
      await session.abortTransaction().catch(() => {});
      session.endSession();

      if (err?.code === 11000 && attempt < maxRetries) continue;
      throw err;
    }
  }

  throw new Error("Failed to create order service after retries");
}

export const updateOrder = async (order_no:string, status:OrderStatusEnum) => {
  try {
    logger.info('public order no', {order_no})
    const updatedOrder = Order.findOneAndUpdate({order_no}, {status}).lean();
    return updatedOrder
  } catch (error:any) {
    throw new Error('Error updating order')
  }
}

export const getUserOrders = async (authUser:IUser) => {
  try {
    const updatedOrder = await Order.find({
      $or: [{ sender_id: authUser._id }, { receiver_id: authUser._id }]
    })
      .select("-sender_id -receiver_id -u2a_payment_id -a2u_payment_id -_id")
      .sort({ updatedAt: -1 })
      .lean();

    return updatedOrder;
  } catch (error:any) {
    throw new Error('Service error getting user orders')
  }
}

export const getUserSingleOrder = async (order_no: string) => {
  try {
    // 🔹 Find the order by order_no
    const order = await Order.findOne({ order_no })
      .select("-sender_id -receiver_id -u2a_payment_id -a2u_payment_id -_id")
      .lean();

    if (!order) {
      throw new Error("Order not found");
    }

    // 🔹 Find all comments linked to this order
    const comments = await Comment.find({ order_no })
      .select("-_id -__v") // optional: exclude metadata fields
      .sort({ createdAt: 1 }) // oldest to newest
      .lean();

    // 🔹 Attach comments to the order object
    return { order: {...order}, comments };
  } catch (error: any) {
    logger.error("Error fetching user single order:", error);
    throw new Error("Service error getting user single order");
  }
};
