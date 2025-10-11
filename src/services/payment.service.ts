import axios from "axios";
import logger from "../config/loggingConfig";
import pi from "../config/platformAPIclient";
import { OrderStatusEnum } from "../models/enums/orderStatusEnum";
import { Order } from "../models/Order";
import { A2UPaymentDataType, PaymentDTO } from "../types";

export const getIncompleteServerPayments = async (): Promise<any> => {
  try {
    const serverPayments = await pi.getIncompleteServerPayments();
    if (!serverPayments || serverPayments.length === 0) { 
      logger.info('No incomplete Pi payments found on the server');
      return [];
    }
    logger.info(`Found ${ serverPayments.length } incomplete Pi payments on the server`, serverPayments);
    return serverPayments;
  } catch (error: any) {
    logger.error(`Failed to fetch incomplete Pi payments from server: ${ error.message }`);
    throw error;
  }
};

export const completeServerPayment = async (serverPayments: PaymentDTO[]): Promise<void> => {
  if (!Array.isArray(serverPayments) || serverPayments.length === 0) {
    logger.warn('No server payments to complete');
    return;
  }

  for (const payment of serverPayments) {
    let transaction = payment.transaction || null;
    const piPaymentId = payment.identifier;
    const metadata = payment.metadata as { orderId: string; senderId: string; receiverID: string };

    if (!piPaymentId) {
      logger.error(`Missing Pi payment ID for payment: ${JSON.stringify(payment)}`);
      continue;
    }

    try {
      let txid = transaction?.txid;

      // Submit payment if txid not yet assigned
      if (!txid) {
        txid = await pi.submitPayment(piPaymentId);
        if (!txid) {
          throw new Error(`Failed to submit Pi payment with ID ${piPaymentId}`);
        }
      }

      // Mark the payment as completed in your DB
      const updatedOrder = await Order.findByIdAndUpdate(
        metadata.orderId, 
        {
          $set: {
            a2u_payment_id: piPaymentId,
            a2u_completed_at: new Date(),
            status: OrderStatusEnum.Completed,
          }
        }
      ).lean()
      .exec();

      if (!metadata.orderId) {
        throw new Error(`Failed to update payment cross reference for ${metadata.orderId}`);
      }

      logger.info('Updated U2U reference record', metadata.orderId);

      // Final confirmation with Pi network
      const completedPiPayment = await pi.completePayment(piPaymentId, txid);
      if (!completedPiPayment) {
        throw new Error(`Failed to confirm Pi payment on blockchain for ${piPaymentId}`);
      }

      logger.info(`✅ A2U payment process completed for xRef ID: ${metadata.orderId}`);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        logger.error(`Axios error during A2U payment for xRef ${metadata.orderId || 'unknown'}: ${error.message}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
      } else {
        logger.error(`❌ Error completing server payment for xRef ID ${metadata.orderId || 'unknown'}: ${error.message}`);
      }
    }
  }
};

export const createA2UPayment = async (a2uPaymentData: A2UPaymentDataType): Promise<string | null> => {
  try {
    const a2uData = {
      amount: parseFloat(a2uPaymentData.amount),
      memo: a2uPaymentData.memo,
      metadata: { direction: "A2U", senderPiUid: a2uPaymentData.senderPiUid, orderIds:a2uPaymentData.orderIds },
      uid: a2uPaymentData.receiverPiUid as string,
    };

    const paymentId = await pi.createPayment(a2uData);
    logger.debug('Payment ID: ', { paymentId });
    if (!paymentId) {
      logger.error(`Failed to create A2U Pi payment for UID ${ a2uPaymentData.receiverPiUid }`);
      throw new Error('Failed to create A2U Pi payment');
    }

    /* Step 5: Submit the Pi payment to finalize the blockchain transaction */
    const txid = await pi.submitPayment(paymentId);
    if (!txid) {
      logger.error(`Failed to submit A2U Pi payment with Payment ID ${ paymentId }`);
      throw new Error('Failed to submit A2U Pi payment');
    }
    logger.info('Transaction ID: ', { txid });

    // get order for each orderIds
    for (const refId of a2uPaymentData.orderIds) {

      // const xRef = await Order.findById(refId)
      // .populate<{receiver: {pi_uid:string}}>({path:'receiver_id', model: 'User', select: 'pi_uid'})
      // .lean()
      // .exec();

      const updatedOrder = await Order.findByIdAndUpdate(
        refId, 
        {
          $set: {
            a2u_payment_id: paymentId,
            a2u_completed_at: new Date(),
            status: OrderStatusEnum.Completed,
          }
        }
      ).lean()
      .exec();

      logger.info('updated Payment xRef record', updatedOrder?.order_no);

    }

    const completedPiPayment = await pi.completePayment(paymentId, txid);
    if (!completedPiPayment) {
      logger.error(`Failed to complete A2U Pi payment with Payment ID ${ paymentId } + Txn ID ${ txid }`);
      throw new Error('Failed to complete A2U Pi payment transaction');
    }

    logger.info(`A2U payment process completed successfully for xRef ID ${ a2uPaymentData.orderIds }`);
    return paymentId;

  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      logger.error(`Axios error during A2U payment: ${error.message}`, {
        status: error.response?.status,
        data: error.response?.data,
        config: error.config,
      });
    } else {
      logger.error(`Failed to create A2U payment for Order ID ${a2uPaymentData.orderIds}:`, {
        message: error.message,
        stack: error.stack,
      });
    }

    // Handle cancellation of the payment if it was created but not completed
    const {incomplete_server_payments} = await getIncompleteServerPayments();
    logger.info("found incomplete server payments", incomplete_server_payments);
    if (incomplete_server_payments && incomplete_server_payments.length > 0) {
      await completeServerPayment(incomplete_server_payments);
    }
    return null;
  }
};