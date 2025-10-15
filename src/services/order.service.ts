import { ClientSession } from "mongoose";
import { addComment } from "./comment.service";
import { logInfo, logWarn, logError } from "../config/loggingConfig";
import { nextOrderNo } from "../helpers/getNextOrderNo";
import { Comment, CommenType } from "../models/Comment";
import { Order, OrderType } from "../models/Order";
import { OrderStatusEnum } from "../models/enums/orderStatusEnum";
import { IUser } from "../types";

function buildStatusComment(
  username: string | undefined,
  status: OrderStatusEnum,
  extraComment?: string
): string {
  const actor = username || "System";
  let base: string;

  switch (status) {
    case OrderStatusEnum.Initiated:
      base = `${actor} has initiated a new payment.`;
      break;

    case OrderStatusEnum.Requested:
      base = `${actor} has requested a new payment.`;
      break;

    case OrderStatusEnum.Paid:
      base = `System has marked the order as paid.`;
      break;

    case OrderStatusEnum.Released:
      base = `System has confirmed this order as completed.`;
      break;

    default:
      base = `${actor} has marked the order as ${status}.`;
      break;
  }

  // ✅ Append any user-supplied comment
  return extraComment?.trim() ? `${base}\n${extraComment.trim()}` : base;
}


export async function createOrderSecure(
  payload: { sender: IUser; receiver: IUser; amount: number; authUser: IUser; comment?: string },
  maxRetries = 3
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = await Order.startSession();
    try {
      session.startTransaction();
      logInfo(`Starting new order creation (Attempt ${attempt}/${maxRetries})`, {
        sender: payload.sender.pi_username,
        receiver: payload.receiver.pi_username,
        amount: payload.amount,
      });

      const orderNo = await nextOrderNo(session);

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

      // ✅ Build and add comment
      const fullComment = buildStatusComment(payload.authUser?.pi_username, OrderStatusEnum.Initiated, payload.comment);

      if (order && fullComment.trim()) {
        await addComment(
          orderNo, 
          fullComment, 
          payload.authUser.pi_username,  
          session
        );
      }

      await session.commitTransaction();
      session.endSession();

      logInfo(`✅ Order successfully created`, { order_no: order.order_no });
      return order.order_no;

    } catch (err: any) {
      await session.abortTransaction().catch(() => {});
      session.endSession();

      if (err?.code === 11000 && attempt < maxRetries) {
        logWarn("⚠️ Duplicate key detected, retrying order creation..", { attempt });
        continue;
      }
      logError("❌ Error creating order", { error: err.message });
      throw err;
    }
  }

  throw new Error("Failed to create order after multiple retries");
}

function resolveNextStatus(prevStatus: OrderStatusEnum, incomingStatus: OrderStatusEnum): OrderStatusEnum {
  if (prevStatus === OrderStatusEnum.Requested && incomingStatus === OrderStatusEnum.Paid) {
    return OrderStatusEnum.Fulfilled;
  }
  return incomingStatus;
}

export const updateOrder = async (
  order_no: string,
  requestedStatus: OrderStatusEnum,
  authUser?: IUser,
  u2a_payment_id?: string,
  u2a_completed_at?: Date,
  a2u_payment_id?: string,
  comment: string = ""
): Promise<{ order: any; comment: any }> => {
  let newComment = null;

  try {
    logInfo("🔄 Processing order update", {
      order_no,
      requestedStatus,
      user: authUser?.pi_username,
    });

    // 1️⃣ Fetch current order
    const currentOrder = await Order.findOne({ order_no });
    if (!currentOrder) {
      logError(`Order with order_no #${ order_no } is not found`);
      throw new Error("Order not found");
    }

    // 2️⃣ Determine next status (handles business logic transitions)
    const nextStatus = resolveNextStatus(currentOrder.status, requestedStatus);

    // 3️⃣ Apply update (only relevant fields)
    currentOrder.status = nextStatus;
    if (u2a_payment_id) currentOrder.u2a_payment_id = u2a_payment_id;
    if (u2a_completed_at) currentOrder.u2a_completed_at = u2a_completed_at;
    if (a2u_payment_id) currentOrder.a2u_payment_id = a2u_payment_id;

    // 4️⃣ Persist updated order
    const updatedOrder = await currentOrder.save();

    // 5️⃣ Build status change comment
    const fullComment = buildStatusComment(authUser?.pi_username, nextStatus, comment);

    // 6️⃣ Save the comment (linked to this order)
    if (authUser) {
      newComment = await addComment(
        order_no,
        fullComment,
        authUser.pi_username
      );
    }

    logInfo(`✅ Order ${order_no} updated successfully`, {
      prevStatus: currentOrder.status,
      newStatus: nextStatus,
    });

    // 7️⃣ Return combined result
    return { order: updatedOrder.toObject(), comment: newComment };

  } catch (err: any) {
    logError("❌ Error updating order", {
      order_no,
      requestedStatus,
      error: err.message,
    });
    throw new Error(`Error updating order: ${err.message}`);
  }
};


export const getUserOrders = async (authUser:IUser) => {
  try {
    logInfo("Fetching user orders", { user: authUser.pi_username });

    const updatedOrder = await Order.find({
      $or: [{ sender_id: authUser._id }, { receiver_id: authUser._id }]
    })
      .select("-sender_id -receiver_id -u2a_payment_id -a2u_payment_id -_id")
      .sort({ updatedAt: -1 })
      .lean();

    return updatedOrder;
  } catch (err: any) {
    logError("❌ Service error getting user orders", { error: err.message });
    throw new Error('Service error getting user orders')
  }
};

export const getUserSingleOrder = async (order_no: string) => {
  try {
    logInfo("Fetching order details", { order_no });
    // 🔹 Find the order by order_no
    const order = await Order.findOne({ order_no })
      .select("-sender_id -receiver_id -u2a_payment_id -a2u_payment_id -_id")
      .lean();

    if (!order) {
      logError(`Order with order_no #${ order_no } is not found`);
      throw new Error("Order not found");
    }

    // 🔹 Find all comments linked to this order
    const comments = await Comment.find({ order_no })
      .select("-__v") // optional: exclude metadata fields
      .sort({ createdAt: 1 }) // oldest to newest
      .lean();

    // 🔹 Attach comments to the order object
    return { order: {...order}, comments };
  } catch (err: any) {
    logError("❌ Service error getting user single order", { error: err.message });
    throw new Error("Service error getting user single order");
  }
};
