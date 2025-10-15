import axios from "axios";
import { logInfo, logWarn, logError } from "../config/loggingConfig";
import pi from "../config/platformAPIclient";
import { OrderStatusEnum } from "../models/enums/orderStatusEnum";
import { Order } from "../models/Order";
import { A2UPaymentDataType, PaymentDTO } from "../types";

export const getIncompleteServerPayments = async (): Promise<any> => {
  try {
    const serverPayments = await pi.getIncompleteServerPayments();
    if (!serverPayments || serverPayments.length === 0) { 
      logInfo('No incomplete Pi payments found on the server');
      return [];
    }
    logInfo(`Found ${ serverPayments.length } incomplete Pi payments on the server`, serverPayments);
    return serverPayments;
  } catch (err: any) {
    logError(`Failed to fetch incomplete Pi payments from server: ${ err.message }`);
    throw err;
  }
};

export const completeServerPayment = async (serverPayments: PaymentDTO[]): Promise<void> => {
  if (!Array.isArray(serverPayments) || serverPayments.length === 0) {
    logWarn('No server payments to complete');
    return;
  }

  logInfo(`Starting completion for ${serverPayments.length} pending server payment(s)`);

  for (const payment of serverPayments) {
    let transaction = payment.transaction || null;
    const piPaymentId = payment.identifier;
    const metadata = payment.metadata as { orderId: string; senderId: string; receiverID: string };

    if (!piPaymentId) {
      logError(`Missing Pi payment ID for payment: ${JSON.stringify(payment)}`);
      continue;
    }

    try {
      let txid = transaction?.txid;

      // Submit payment if txid not yet assigned
      if (!txid) {
        logInfo(`Submitting Pi payment for ID: ${piPaymentId}`);
        txid = await pi.submitPayment(piPaymentId);
        if (!txid) {
          throw new Error(`Failed to submit Pi payment with ID ${piPaymentId}`);
        }
        logInfo(`Received txid: ${txid} for Pi payment ${piPaymentId}`);
      }

      if (!metadata?.orderId) {
        throw new Error(`Missing order reference for Pi payment ${piPaymentId}`);
      }

      logInfo(`Updating Order ${metadata.orderId} to Released status..`);

      // Mark the payment as completed in your DB
      const updatedOrder = await Order.findByIdAndUpdate(
        metadata.orderId, 
        {
          $set: {
            a2u_payment_id: piPaymentId,
            a2u_completed_at: new Date(),
            status: OrderStatusEnum.Released,
          }
        },
        { new: true }
      ).lean()
      .exec();

      if (!updatedOrder) {
        throw new Error(`Failed to update order ${metadata.orderId} for Pi payment ${piPaymentId}`);
      }

      logInfo(`Successfully updated order record for ${metadata.orderId}`);

      logInfo(`Confirming payment on blockchain for Pi Payment ID: ${piPaymentId}`);
      // Final confirmation with Pi network
      const completedPiPayment = await pi.completePayment(piPaymentId, txid);
      if (!completedPiPayment) {
        throw new Error(`Failed to confirm Pi payment on blockchain for ${piPaymentId}`);
      }

      logInfo(`✅ A2U payment process completed successfully for Order ${metadata.orderId}`);
    } catch (err: any) {
      const orderRef = metadata?.orderId || "unknown";

      if (axios.isAxiosError(err)) {
        logError(`Axios error during A2U payment for Order ${orderRef}: ${err.message} (status: ${err.response?.status || "N/A"})`);
      } else {
        logError(`❌ Error completing server payment for Order ${orderRef}: ${err.message}`);
      }
    }
  }
};

export const createA2UPayment = async (a2uPaymentData: A2UPaymentDataType): Promise<string | null> => {
  const { amount, memo, senderPiUid, receiverPiUid, orderIds } = a2uPaymentData;
  logInfo(`Starting A2U payment creation for receiver UID: ${receiverPiUid} | Orders: ${orderIds.join(", ")}`);
  try {
    const a2uData = {
      amount: parseFloat(amount),
      memo,
      metadata: { direction: "A2U", senderPiUid, orderIds },
      uid: receiverPiUid as string,
    };

    logInfo(`Creating A2U Pi payment with amount ${a2uData.amount} and memo: "${memo}"`);
    const paymentId = await pi.createPayment(a2uData);
    if (!paymentId) {
      throw new Error('Failed to create A2U Pi payment');
    }
    
    logInfo(`A2U Pi payment created with Payment ID: ${paymentId}. Submitting to blockchain..`);
    /* Step 5: Submit the Pi payment to finalize the blockchain transaction */
    const txid = await pi.submitPayment(paymentId);
    if (!txid) {
      throw new Error('Failed to submit A2U Pi payment');
    }

    logInfo(`A2U payment submitted successfully with txid: ${txid}`);

    // get order for each orderIds
    for (const refId of orderIds) {
      try {
        logInfo(`Updating Order ref ${refId} with A2U payment details..`);

        const updatedOrder = await Order.findByIdAndUpdate(
          refId, 
          {
            $set: {
              a2u_payment_id: paymentId,
              a2u_completed_at: new Date(),
              status: OrderStatusEnum.Released,
            }
          },
          { new: true }
        ).lean()
        .exec();

        if (!updatedOrder) {
          logWarn(`Order ref ${refId} not found or failed to update during A2U payment processing.`);
        } else {
          logInfo(`Order ref ${refId} successfully updated with A2U payment ID: ${paymentId}`);
        }
      } catch  (orderErr: any) {
        logError(`Error updating order ref ${refId}: ${orderErr.message}`);
      }
    }

    logInfo(`Confirming A2U payment completion on blockchain for Payment ID: ${paymentId}`);
    const completedPiPayment = await pi.completePayment(paymentId, txid);
    if (!completedPiPayment) {
      throw new Error(`Failed to complete A2U Pi payment transaction for Payment ID: ${paymentId}`);
    }

    logInfo(`A2U payment successfully completed for receiver UID: ${receiverPiUid} | Payment ID: ${paymentId}`);
    return paymentId;
  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      logError(`Axios error during A2U payment for receiver ${receiverPiUid}: ${err.message}`, {
        status: err.response?.status,
        data: err.response?.data,
        config: err.config,
      });
    } else {
      logError(`Failed to create A2U payment for Orders ${orderIds.join(", ")}: ${err.message}`, {
        stack: err.stack,
      });
    }

    // Handle incomplete server payments gracefully
    try {
      logInfo("Checking for incomplete server payments to finalize..");
      const { incomplete_server_payments } = await getIncompleteServerPayments();

      if (incomplete_server_payments && incomplete_server_payments.length > 0) {
        logWarn(`Found ${incomplete_server_payments.length} incomplete server payments. Attempting completion..`);
        await completeServerPayment(incomplete_server_payments);
      } else {
        logInfo("No incomplete server payments found.");
      }
    } catch (err: any) {
      logError(`Error while handling incomplete payments: ${err.message}`);
    }

    return null;
  }
};