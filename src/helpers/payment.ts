import axios from 'axios';
import { platformAPIClient } from '../config/platformAPIclient';
import logger from '../config/loggingConfig';
import { IUser, PaymentDTO, PaymentInfo, U2AMetadata } from '../types';
import { updateOrder } from '../services/order.service';
import { OrderStatusEnum } from '../models/enums/orderStatusEnum';
import { getUser, validateUsername } from '../services/user.service';
import { enqueuePayment } from '../cron/utils/queues/queue';

const logPlatformApiError = (error: any, context: string) => {
  if (error.response) {
    logger.error(`${context} - platformAPIClient error`, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response.status,
      data: error.response.data,
    });
  } else {
    logger.error(`${context} - Unhandled error`, {
      message: error.message,
      stack: error.stack,
    });
  }
};

/**
 * Complete a Pi payment (U2A) in both DB and blockchain
 */
const completePiPayment = async (piPaymentId: string, txid: string) => {
  const res = await platformAPIClient.get(`/v2/payments/${ piPaymentId }`);
  const currentPayment: PaymentDTO = res.data;
  const metadata = currentPayment.metadata;

  if (!txid) {
    logger.warn("No transaction ID");
    throw new Error("No transaction ID");
  }
  
  // Mark the payment as completed
  logger.info("Payment record marked as completed");
  const today = new Date()
  const authUser = await getUser(currentPayment.user_uid) as IUser;
  const updatedOrder = await updateOrder(metadata.order_no, OrderStatusEnum.Paid, authUser, currentPayment.identifier, today);

  // Enqueue the payment for further processing (e.g., A2U payment)
  await enqueuePayment(
    updatedOrder.order?._id.toString(), 
    currentPayment.memo
  );

  // Notify Pi Platform of successful completion
  const completedPiPayment = await platformAPIClient.post(`/v2/payments/${ piPaymentId }/complete`, { txid });      
  if (completedPiPayment.status !== 200) {
    logger.error("Failed to mark U2A payment completed on Pi blockchain")
    throw new Error("Failed to mark U2A payment completed on Pi blockchain");
  }

  logger.info("Payment marked completed on Pi blockchain", completedPiPayment.status);
  return completedPiPayment;
};

/**
 * Process incomplete payment
 */
export const processIncompletePayment = async (payment: PaymentInfo) => {
  try {
    const piPaymentId = payment.identifier;
    const txid = payment.transaction?.txid;
    const txURL = payment.transaction?._link;

    // Retrieve the original (incomplete) payment record by its identifier
    // const incompletePayment = await getPayment(piPaymentId);

    // Fetch the payment memo from the Pi Blockchain via Horizon API
    const horizonResponse = await axios.create({ timeout: 20000 }).get(txURL!);
    const blockchainMemo = horizonResponse.data.memo;
    logger.info("paymentIdOnBlock: ", blockchainMemo);

    // Validate that the memo from the blockchain matches the expected payment ID
    // if (blockchainMemo !== incompletePayment.pi_payment_id) {
    //   throw new Error("Unable to find payment on the Pi Blockchain");
    // }

    await completePiPayment(piPaymentId, txid as string);

    return {
      success: true,
      message: `Payment completed from incomplete payment with id ${ piPaymentId }`,
    };
  } catch (error: any) {
    logPlatformApiError(error, "processIncompletePayment");
    throw(error);
  }
};

/**
 * Approve payment
 */
export const processPaymentApproval = async (
  paymentId: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    // Fetch payment details from the Pi platform using the payment ID
    const res = await platformAPIClient.get(`/v2/payments/${ paymentId }`);
    const currentPayment: PaymentDTO = res.data;
    const metadata = currentPayment.metadata;

    await updateOrder(metadata.order_no, OrderStatusEnum.Initiated, undefined, currentPayment.identifier);
    logger.info("payment approved from backend with metadata: ", {metadata})

    // Approve the payment on the Pi platform
    await platformAPIClient.post(`/v2/payments/${ currentPayment.identifier }/approve`);

    return {
      success: true,
      message: `Payment approved with id ${ currentPayment.identifier }`,
    };
  } catch (error: any) {
    logPlatformApiError(error, "processPaymentApproval");
    throw(error);
  }
};

/**
 * Complete payment
 */
export const processPaymentCompletion = async (
  paymentId: string, 
  txid: string
) => {
  try {
    // Confirm the payment exists via Pi platform API
    await completePiPayment(paymentId, txid);
    return {
      success: true,
      message: `U2A Payment completed with id ${ paymentId }`,
    };
  } catch (error: any) {
    logPlatformApiError(error, "processPaymentCompletion");
    throw(error);
  }
}; 

/**
 * Cancel payment
 */
export const processPaymentCancellation = async (paymentId: string) => {
  try {
    // Mark the payment as cancelled
    logger.info('Order record updated to cancelled');

    // Notify the Pi platform that the payment has been cancelled
    await platformAPIClient.post(`/v2/payments/${ paymentId }/cancel`);
    logger.info('Successfully posted cancellation to Pi platform');

    return {
      success: true,
      message: `Payment cancelled with id ${ paymentId }`,
    };
  } catch (error: any) {
    logPlatformApiError(error, "processPaymentCancellation");
    throw(error);
  }
};

/**
 * Handle payment error
 */
export const processPaymentError = async (paymentDTO: PaymentDTO) => {
  try {
    // handle existing payment
    const transaction = paymentDTO.transaction;
    const paymentId = paymentDTO.identifier;

    if (transaction) {        
      const PaymentData = {
        identifier: paymentId,
        transaction: {
          txid: transaction.txid,
          _link: transaction._link,
        }
      };
      await processIncompletePayment(PaymentData);
      return {
        success: true,
        message: `Payment Error with ID ${paymentId} handled and completed successfully`,
      };
    } else {
      logger.warn("No transaction data found for existing payment");
      await processPaymentCancellation(paymentId);
      return {
        success: true,
        message: `Payment Error with ID ${paymentId} cancelled successfully`,
      };
    }
  } catch (error: any) {
    logPlatformApiError(error, "processPaymentError");
    throw(error);
  }
};