import logger from "../config/loggingConfig";
import { nextOrderNo } from "../helpers/getNextOrderNo";
import { Comment } from "../models/Comment";
import { Order } from "../models/Order";
import { IUser } from "../types";
import { OrderStatusEnum } from "../models/enums/orderStatusEnum";
import { addComment } from "./comment.service";

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

      // ✅ Build and add comment
      const fullComment = buildStatusComment(payload.authUser?.pi_username, OrderStatusEnum.Initiated, payload.comment);

      if (order && fullComment.trim()) {
        await addComment(
          orderNo, 
          fullComment, 
          payload.authUser.pi_username,  
          session
        );
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
    logger.info("🔄 Processing order update", {
      order_no,
      requestedStatus,
      user: authUser?.pi_username,
    });

    // 1️⃣ Fetch current order
    const currentOrder = await Order.findOne({ order_no });
    if (!currentOrder) {
      logger.warn("⚠️ Order not found", { order_no });
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

    logger.info(`✅ Order ${order_no} updated successfully`, {
      prevStatus: currentOrder.status,
      newStatus: nextStatus,
    });

    // 7️⃣ Return combined result
    return { order: updatedOrder.toObject(), comment: newComment };

  } catch (error: any) {
    logger.error("❌ Error updating order", {
      order_no,
      requestedStatus,
      error: error.message,
    });
    throw new Error(`Error updating order: ${error.message}`);
  }
};


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
      .select("-__v") // optional: exclude metadata fields
      .sort({ createdAt: 1 }) // oldest to newest
      .lean();

    // 🔹 Attach comments to the order object
    return { order: {...order}, comments };
  } catch (error: any) {
    logger.error("Error fetching user single order:", error);
    throw new Error("Service error getting user single order");
  }
};
