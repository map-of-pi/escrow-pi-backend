import { logInfo, logError } from "../../config/loggingConfig";
import { Order, OrderType } from "../../models/Order";
import A2UPaymentQueue from "../../models/A2UPaymentQueue";
import User from "../../models/User";
import { IUser } from "../../types";

const GAS_FEE = 0.01;

const batchSellerRevenue = async (
  orderId: string,
  receiverPiUid: string,
  senderPiUid: string,
  amount: string,
): Promise<void> => {
  logInfo(`[→] Starting batchSellerRevenue for seller: ${receiverPiUid} w/ order: ${orderId}`);
  try {
    const onQueuePayment = await A2UPaymentQueue.findOne({ receiverPiUid, status:"batching", last_a2u_date: null }).exec();
    if (!onQueuePayment) {
      const newAmount = parseFloat(amount) - GAS_FEE;
      await A2UPaymentQueue.create({
        xRef_ids: [orderId],
        receiverPiUid,
        senderPiUid,
        amount: newAmount.toFixed(4),
        status: "batching",
        memo: "Escrow Pi Payment for Order",
      });
      logInfo(`[✔] New payment added to queue for seller: ${receiverPiUid}`);
      return;
    }

    const updatedQueue = await A2UPaymentQueue.findOneAndUpdate(
      { receiverPiUid, status:"batching", last_a2u_date: null },
      {
        $inc: { amount: parseFloat(amount) },
        $push: { xRef_ids: orderId },
      },
      { new: true }
    ).exec();
   
    if (!updatedQueue) {
      logError(`[✘] Failed to update payment queue for seller: ${receiverPiUid}`);
      throw new Error(`Failed to update payment queue for seller: ${receiverPiUid}`);
    }

    logInfo(`[✔] Updated payment queue for seller: ${receiverPiUid} w/ new amount: ${updatedQueue.amount}`);
    return;

  } catch (err: any) {
    logError(`[✘] Failed to enqueue batch payment for seller ${receiverPiUid}: ${err.message}`);
  }
};

export const enqueuePayment = async (
  orderId: string,
  memo:string
): Promise<void> => {
  logInfo(`[→] Starting enqueuePayment for order: ${orderId}`);
  try {
    const order = await Order.findById(orderId).exec() as OrderType;
    // check if seller gas saver is on
    const receiver = await User.findById( order.receiver_id ).lean().exec() as IUser;
    const sender = await User.findById( order.sender_id ).lean().exec() as IUser;
    const amount = order.amount;   
    const newAmount = amount - GAS_FEE;

    await A2UPaymentQueue.create({
      xRef_ids: [orderId],
      receiverPiUid: receiver.pi_uid,
      senderPiUid: sender.pi_uid,
      amount: newAmount.toFixed(4),
      status: "pending",
      memo: memo,
    });
    logInfo(`[✔] New payment added to queue for order: ${orderId} | receiver: ${receiver.pi_uid}`);
    return;

  } catch (err: any) {
    logError(`[✘] enqueuePayment failed for order ${orderId}: ${err.message}`);
    throw new Error(`Error while adding A2U payment to queue ${err}`);
  }
};