import axios from 'axios';
import { logInfo, logWarn, logError } from "../config/loggingConfig";
import { platformAPIClient } from '../config/platformAPIclient';
import { OrderStatusEnum } from '../models/enums/orderStatusEnum';
import { updateOrder } from '../services/order.service';
import { getUser, validateUsername } from '../services/user.service';
import { IUser, PaymentDTO, PaymentInfo, U2AMetadata } from '../types';
import { enqueuePayment } from '../cron/utils/queues/queue';

const logPlatformApiError = (error: any, context: string) => {
  if (error.response) {
    logError(`${context} - platformAPIClient error`, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response.status,
      data: error.response.data,
    });
  } else {
    logError(`${context} - Unhandled error`, {
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
    logWarn(`No transaction ID provided for payment ${piPaymentId}`);
    throw new Error("No transaction ID provided");
  }
  
  // Mark the payment as completed
  logInfo(`Marking payment ${piPaymentId} as completed`);
  const today = new Date()
  const authUser = await getUser(currentPayment.user_uid) as IUser;
  
  const updatedOrder = await updateOrder(
    metadata.order_no, 
    OrderStatusEnum.Paid, 
    authUser, 
    currentPayment.identifier, 
    today
  );

  // Enqueue the payment for further processing (e.g., A2U payment)
  await enqueuePayment(
    updatedOrder.order?._id.toString(), 
    currentPayment.memo
  );

  // Notify Pi Platform of successful completion
  const completedPiPayment = await platformAPIClient.post(`/v2/payments/${ piPaymentId }/complete`, { txid });      
  if (completedPiPayment.status !== 200) {
    logError(`Failed to mark U2A payment ${piPaymentId} as completed on Pi blockchain`);
    throw new Error("Failed to mark U2A payment completed on Pi blockchain");
  }

  logInfo(`Payment ${piPaymentId} marked completed on Pi blockchain`);
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

    if (!txURL) {
      logWarn(`No blockchain link found for incomplete payment ${piPaymentId}`);
      throw new Error("No blockchain link found for payment");
    }

    // Retrieve the original (incomplete) payment record by its identifier
    // const incompletePayment = await getPayment(piPaymentId);

    // Fetch the payment memo from the Pi Blockchain via Horizon API
    const horizonResponse = await axios.create({ timeout: 20000 }).get(txURL!);
    const blockchainMemo = horizonResponse.data.memo;
    logInfo(`Retrieved blockchain memo for payment ${piPaymentId} | ${blockchainMemo}`);

    // Validate that the memo from the blockchain matches the expected payment ID
    // if (blockchainMemo !== incompletePayment.pi_payment_id) {
    //   throw new Error("Unable to find payment on the Pi Blockchain");
    // }

    await completePiPayment(piPaymentId, txid as string);

    return {
      success: true,
      message: `Payment completed from incomplete payment with ID: ${ piPaymentId }`,
    };
  } catch (err: any) {
    logPlatformApiError(err, "processIncompletePayment");
    throw err;
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
    logInfo(`Payment ${paymentId} approved on backend with metadata`, { metadata });

    // Approve the payment on the Pi platform
    await platformAPIClient.post(`/v2/payments/${ currentPayment.identifier }/approve`);

    return {
      success: true,
      message: `Payment approved with ID: ${ currentPayment.identifier }`,
    };
  } catch (err: any) {
    logPlatformApiError(err, "processPaymentApproval");
    throw err;
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
      message: `U2A Payment completed with ID: ${ paymentId }`,
    };
  } catch (err: any) {
    logPlatformApiError(err, "processPaymentCompletion");
    throw err;
  }
}; 

/**
 * Cancel payment
 */
export const processPaymentCancellation = async (paymentId: string) => {
  try {
    // Mark the payment as cancelled
    logInfo(`Marking payment ${paymentId} as cancelled`);

    // Notify the Pi platform that the payment has been cancelled
    await platformAPIClient.post(`/v2/payments/${ paymentId }/cancel`);
    logInfo(`Successfully posted cancellation to Pi platform for payment ${paymentId}`);

    return {
      success: true,
      message: `Payment cancelled with id ${ paymentId }`,
    };
  } catch (err: any) {
    logPlatformApiError(err, "processPaymentCancellation");
    throw err;
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
      logWarn(`No transaction data for payment ${paymentId}; cancelling payment`);
      await processPaymentCancellation(paymentId);
      return {
        success: true,
        message: `Payment Error with ID ${paymentId} cancelled successfully`,
      };
    }
  } catch (err: any) {
    logPlatformApiError(err, "processPaymentError");
    throw err;
  }
};