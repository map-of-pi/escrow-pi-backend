import { ClientSession } from "mongoose";
import { addComment } from "./comment.service";
import { logInfo, logWarn, logError } from "../config/loggingConfig";
import { nextOrderNo } from "../helpers/order";
import { Comment } from "../models/Comment";
import { Order } from "../models/Order";
import { OrderStatusEnum } from "../models/enums/orderStatusEnum";
import { IUser } from "../types";
import * as notificationService from "./notification.service";

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
        sender_pi_uid: payload.sender.pi_uid,
        receiver_id: payload.receiver._id,
        receiver_username: payload.receiver.pi_username,
        receiver_pi_uid: payload.receiver.pi_uid,
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

      // 🔔 Notify counterparty about new transaction (Pay or Receive)
      try {
        const actorPiUid = payload.authUser.pi_uid;
        const isActorSender = actorPiUid === payload.sender.pi_uid;
        const recipientPiUid = isActorSender ? payload.receiver.pi_uid : payload.sender.pi_uid;
        const reason = isActorSender
          ? `Order ${orderNo}: New EscrowPi payment created by ${payload.sender.pi_username}`
          : `Order ${orderNo}: New EscrowPi request created by ${payload.receiver.pi_username}`;
        await notificationService.addNotification(recipientPiUid, reason);
      } catch (e) {
        logWarn("Failed to create counterparty notification after order creation", { error: (e as any)?.message, order_no: orderNo });
      }

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

    // 🔔 Notify counterparty about status change (skip for Initiated)
    if (nextStatus !== OrderStatusEnum.Initiated) {
      try {
        const actorPiUid = authUser?.pi_uid;
        const senderPiUid = currentOrder.sender_pi_uid as unknown as string;
        const receiverPiUid = currentOrder.receiver_pi_uid as unknown as string;
        const recipientPiUid = actorPiUid === senderPiUid ? receiverPiUid : senderPiUid;
        const actorLabel = authUser?.pi_username ? authUser.pi_username : 'System';
        const reason = `Order ${order_no} status changed to ${nextStatus} by ${actorLabel}`;
        if (recipientPiUid) {
          await notificationService.addNotification(recipientPiUid, reason);
        }
      } catch (e) {
        logWarn("Failed to create counterparty notification after status update", { error: (e as any)?.message, order_no });
      }
    }

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

export const getUserOrders = async (authUser: IUser) => {
  try {
    logInfo("Fetching user orders", { user: authUser.pi_username });

    const updatedOrder = await Order.find({
      $or: [{ sender_id: authUser._id }, { receiver_id: authUser._id }],
    })
      .select("-sender_id -receiver_id -u2a_payment_id -a2u_payment_id -_id")
      .sort({ updatedAt: -1 })
      .lean();

    return updatedOrder;
  } catch (err: any) {
    logError("❌ Service error getting user orders", { error: err.message });
    throw new Error("Service error getting user orders");
  }
};

export const getUserSingleOrder = async (order_no: string) => {
  try {
    logInfo("Fetching order details", { order_no });
    const order = await Order.findOne({ order_no })
      .select("-sender_id -receiver_id -u2a_payment_id -a2u_payment_id -_id")
      .lean();

    if (!order) {
      logError(`Order with order_no #${order_no} is not found`);
      throw new Error("Order not found");
    }

    // 🔹 Find all comments linked to this order
    const comments = await Comment.find({ order_no })
      .select("-__v") // optional: exclude metadata fields
      .sort({ createdAt: 1 }) // oldest to newest
      .lean();

    return { order: { ...order }, comments };
  } catch (err: any) {
    logError("❌ Service error getting user single order", { error: err.message });
    throw new Error("Service error getting user single order");
  }
};

// ===== Dispute services =====

const assertParticipant = (order: any, user: IUser) => {
  const isSender = String(order.sender_id) === String(user._id) || order.sender_username === user.pi_username;
  const isReceiver = String(order.receiver_id) === String(user._id) || order.receiver_username === user.pi_username;
  if (!isSender && !isReceiver) {
    throw new Error("Not authorized to modify this order");
  }
  return { isSender, isReceiver };
};

export const proposeDispute = async (
  order_no: string,
  payload: { percent?: number; amount?: number; note?: string },
  authUser: IUser
) => {
  try {
    const order = await Order.findOne({ order_no });
    if (!order) throw new Error("Order not found");
    assertParticipant(order, authUser);

    if (!payload || (payload.percent == null && payload.amount == null)) {
      throw new Error("Provide percent or amount for dispute proposal");
    }
    if (payload.percent != null && (payload.percent < 0 || payload.percent > 100)) {
      throw new Error("Percent out of range");
    }

    if (order.dispute?.status === 'proposed') {
      // idempotent: if same proposer and same values, return current
      if (
        order.dispute.proposed_by === authUser.pi_username &&
        (payload.percent == null || order.dispute.proposal_percent === payload.percent) &&
        (payload.amount == null || order.dispute.proposal_amount === payload.amount)
      ) {
        return { order: order.toObject() };
      }
    }

    order.dispute = {
      ...(order.dispute || {}),
      is_disputed: true,
      status: 'proposed',
      proposal_percent: payload.percent ?? order.dispute?.proposal_percent,
      proposal_amount: payload.amount ?? order.dispute?.proposal_amount,
      proposed_by: authUser.pi_username,
      proposed_at: new Date(),
      history: [
        ...((order.dispute && order.dispute.history) || []),
        { action: 'proposed', by: authUser.pi_username, at: new Date(), percent: payload.percent, amount: payload.amount, note: payload.note }
      ]
    } as any;

    await order.save();

    const proposedPct = (payload.percent ?? order.dispute?.proposal_percent);
    const proposedPctText = (typeof proposedPct === 'number') ? `${proposedPct}%` : 'n/a%';

    // Add comment
    try {
      await addComment(order_no, `Dispute proposal (${proposedPctText}) sent by ${authUser.pi_username}`, authUser.pi_username);
    } catch (e) {
      logWarn("Failed to add 'proposal sent' comment", { order_no, error: (e as any)?.message });
    }

    // Notify counterparty
    try {
      const recipientPiUid = authUser.pi_uid === order.sender_pi_uid ? order.receiver_pi_uid : order.sender_pi_uid;
      await notificationService.addNotification(recipientPiUid, `Order ${order_no}: Dispute proposal (${proposedPctText}) sent by ${authUser.pi_username}`);
    } catch (e) {
      logWarn("Failed to create notification for dispute proposal", { error: (e as any)?.message, order_no });
    }

    return { order: order.toObject() };
  } catch (err: any) {
    logError("❌ Error proposing dispute", { order_no, error: err.message });
    throw err;
  }
};

export const acceptDispute = async (
  order_no: string,
  payload: { note?: string },
  authUser: IUser
) => {
  try {
    const order = await Order.findOne({ order_no });
    if (!order) throw new Error("Order not found");
    assertParticipant(order, authUser);

    if (!order.dispute || order.dispute.status !== 'proposed') {
      throw new Error("No active dispute proposal to accept");
    }
    if (order.dispute.proposed_by === authUser.pi_username) {
      throw new Error("Proposer cannot accept their own proposal");
    }

    order.dispute.status = 'accepted';
    (order.dispute as any).accepted_by = authUser.pi_username;
    (order.dispute as any).accepted_at = new Date();
    order.dispute.history = [
      ...order.dispute.history,
      { action: 'accepted', by: authUser.pi_username, at: new Date(), note: payload.note }
    ] as any;

    // ✅ Mark the transaction as released when dispute is accepted
    order.status = OrderStatusEnum.Released;

    await order.save();

    const acceptedPct = order.dispute?.proposal_percent;
    const acceptedPctText = (typeof acceptedPct === 'number') ? `${acceptedPct}%` : 'n/a%';

    // Add acceptance comment (requested phrasing)
    try {
      await addComment(order_no, `Dispute proposal (${acceptedPctText}) accepted by ${authUser.pi_username}`, authUser.pi_username);
    } catch (e) {
      logWarn("Failed to add 'proposal accepted' comment", { order_no, error: (e as any)?.message });
    }

    // Add status change comment (Released)
    try {
      const statusComment = buildStatusComment(authUser?.pi_username, OrderStatusEnum.Released);
      await addComment(order_no, statusComment, authUser.pi_username);
    } catch (e) {
      logWarn("Failed to add 'Released' status change comment after dispute acceptance", { order_no, error: (e as any)?.message });
    }

    // Notify counterparty about dispute acceptance
    try {
      const recipientPiUid = authUser.pi_uid === order.sender_pi_uid ? order.receiver_pi_uid : order.sender_pi_uid;
      await notificationService.addNotification(recipientPiUid, `Dispute proposal (${acceptedPctText}) accepted by ${authUser.pi_username}`);
    } catch (e) {
      logWarn("Failed to create notification for dispute acceptance", { error: (e as any)?.message, order_no });
    }

    // Notify about status update to Released
    try {
      const recipientPiUid = authUser.pi_uid === order.sender_pi_uid ? order.receiver_pi_uid : order.sender_pi_uid;
      await notificationService.addNotification(recipientPiUid, `Order ${order_no} status changed to Released`);
    } catch (e) {
      logWarn("Failed to create notification for status change to Released after dispute acceptance", { error: (e as any)?.message, order_no });
    }

    return { order: order.toObject() };
  } catch (err: any) {
    logError("❌ Error accepting dispute", { order_no, error: err.message });
    throw err;
  }
};

export const declineDispute = async (
  order_no: string,
  payload: { note?: string },
  authUser: IUser
) => {
  try {
    const order = await Order.findOne({ order_no });
    if (!order) throw new Error("Order not found");
    assertParticipant(order, authUser);

    if (!order.dispute || order.dispute.status !== 'proposed') {
      throw new Error("No active dispute proposal to decline");
    }
    if (order.dispute.proposed_by === authUser.pi_username) {
      throw new Error("Proposer cannot decline their own proposal");
    }

    order.dispute.status = 'declined';
    (order.dispute as any).declined_by = authUser.pi_username;
    (order.dispute as any).declined_at = new Date();
    order.dispute.history = [
      ...order.dispute.history,
      { action: 'declined', by: authUser.pi_username, at: new Date(), note: payload.note }
    ] as any;

    await order.save();

    try { await addComment(order_no, `Dispute proposal declined`, authUser.pi_username); } catch {}

    try {
      const recipientPiUid = authUser.pi_uid === order.sender_pi_uid ? order.receiver_pi_uid : order.sender_pi_uid;
      await notificationService.addNotification(recipientPiUid, `Order ${order_no}: Dispute proposal declined by ${authUser.pi_username}`);
    } catch (e) {
      logWarn("Failed to create notification for dispute decline", { error: (e as any)?.message, order_no });
    }


    return { order: order.toObject() };
  } catch (err: any) {
    logError("❌ Error declining dispute", { order_no, error: err.message });
    throw err;
  }
};
