
import logger from "../../../config/loggingConfig";
import { Order, OrderType } from "../../../models/Order";
import A2UPaymentQueue from "../../../models/A2UPaymentQueue";
import User from "../../../models/User";
import { IUser } from "../../../types";

const GAS_FEE = 0.01;

const batchSellerRevenue = async (
  orderId: string,
  receiverPiUid: string,
  senderPiUid: string,
  amount: string,
): Promise<void> => {
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
      logger.info("new payment added to queue for seller with ID: ", receiverPiUid)
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
      logger.error(`Failed to update payment queue for seller: ${receiverPiUid}`);
      throw new Error(`Failed to update payment queue for seller: ${receiverPiUid}`);
    }

    logger.info(`Updated payment queue for seller: ${receiverPiUid}, new amount: ${updatedQueue.amount}`);
    return

  } catch (error:any) {
    logger.error("failed to enque payment")
  }

}

export const enqueuePayment = async (
  orderId: string,
  memo:string
) => {
  logger.info('start enqueue payment')
  try {
    const order = await Order.findById(orderId).exec() as OrderType;
    // check if seller gas saver is on
    const receiver = await User.findById( order.receiver_id ).lean().exec() as IUser;
    const sender = await User.findById( order.sender_id ).lean().exec() as IUser;
    const amount = order.amount
    
    // // check and compute seller revenue for gas saver
    // if (seller?.gas_saver) {
    //   batchSellerRevenue(xRefId, seller.seller_id, amount);
    //   return
    // }
    
    const newAmount = amount - GAS_FEE;

    await A2UPaymentQueue.create({
      xRef_ids: [orderId],
      receiverPiUid: receiver.pi_uid,
      senderPiUid: sender.pi_uid,
      amount: newAmount.toFixed(4),
      status: "pending",
      memo: memo,
    });
    logger.info("new payment added to queue for order with ID: ", {orderId})
    return;

  } catch (error:any) {
    logger.error('error while adding A2U payment to queue', {error});
    throw new Error(`error while adding A2U payment to queue ${error}`);
  }
}