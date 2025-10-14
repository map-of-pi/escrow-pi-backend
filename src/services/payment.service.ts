import axios from "axios";
import logger from "../config/loggingConfig";
import pi from "../config/platformAPIclient";
import { OrderStatusEnum } from "../models/enums/orderStatusEnum";
import { Order } from "../models/Order";
import { A2UMetadata, A2UPaymentDataType, PaymentDTO } from "../types";

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

  logger.info("found incomplete server payments", serverPayments);
  for (const payment of serverPayments) {
    const piPaymentId = payment.identifier;
    const txn = payment.transaction;
    const metadata = payment.metadata as A2UMetadata;

    try {      
      if (!txn) {
        await pi.cancelPayment(payment.identifier);
      }

      await createA2UPayment({
        piPaymentId: piPaymentId,
        receiverPiUid: metadata.receiverPiUid,
        amount: payment.amount.toString(),
        memo: payment.memo,
        orderIds: metadata.orderIds,
        senderPiUid: metadata.senderPiUid
      })
      logger.info(`✅ A2U payment process completed for xRef ID: ${metadata.orderIds}`);

    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        logger.error(`Axios error from completeServerPayment xRef ${metadata.orderIds || 'unknown'}: ${error.message}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
      } else {
        logger.error(`❌ Error completing server payment for xRef ID ${metadata.orderIds || 'unknown'}: ${error.message}`);
      }      
      return
    }
  }
};

export const createA2UPayment = async (a2uPaymentData: A2UPaymentDataType): Promise<string | null> => {
  logger.info('started to create A2U payment func');
  try {
    let paymentId = a2uPaymentData.piPaymentId
    if (!paymentId) {
      logger.info('creating new payment...')
      const a2uData = {
        amount: parseFloat(a2uPaymentData.amount),
        memo: a2uPaymentData.memo,
        metadata: { 
          direction: "A2U", 
          receiverPiUid: a2uPaymentData.receiverPiUid,
          senderPiUid: a2uPaymentData.senderPiUid, 
          orderIds:a2uPaymentData.orderIds 
        },
        uid: a2uPaymentData.receiverPiUid as string,
      };

      paymentId = await pi.createPayment(a2uData);
      logger.debug('Payment ID: ', { paymentId });
      if (!paymentId) {
        logger.error(`Failed to create A2U Pi payment for UID ${ a2uPaymentData.receiverPiUid }`);
        throw new Error('Failed to create A2U Pi payment');
      }
    }

    /* Step 5: Submit the Pi payment to finalize the blockchain transaction */
    const txid = await pi.submitPayment(paymentId);
    if (!txid) {
      logger.error(`Failed to submit A2U Pi payment with Payment ID ${ paymentId }`);
      throw new Error('Failed to submit A2U Pi payment');
    }
    logger.info('Transaction ID: ', { txid });

    // Mark the payment as completed in your DB
    if (!Array.isArray(a2uPaymentData.orderIds) || a2uPaymentData.orderIds.length === 0) {
      throw new Error("No valid order IDs provided in metadata.orderIds");
    }

    // Mark the payments as completed for all orders
    for (const refId of a2uPaymentData.orderIds) {

      const updatedOrder = await Order.findByIdAndUpdate(
        refId, 
        {
          $set: {
            a2u_payment_id: paymentId,
            a2u_completed_at: new Date(),
            status: OrderStatusEnum.Released,
          }
        }
      ).lean()
      .exec();

      if (!updatedOrder) {
        logger.warn('Order update error in createA2UPayment with id:  ', refId);
        continue;
      }
      logger.info('updated Payment xRef record', updatedOrder?.order_no);
    }

    logger.info('updated order records');

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
    if (incomplete_server_payments && incomplete_server_payments.length > 0) {
      await completeServerPayment(incomplete_server_payments);
      return null
    }   
    return null; 
  }
};