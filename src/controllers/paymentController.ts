import { Request, Response } from "express";
import { logInfo, logWarn, logError } from "../config/loggingConfig";
import { 
  processIncompletePayment, 
  processPaymentApproval, 
  processPaymentCancellation, 
  processPaymentCompletion,
  processPaymentError
} from "../helpers/payment";

export const onIncompletePaymentFound = async (req: Request, res: Response) => {
 const { payment } = req.body;

 if (!payment) {
  logWarn("onIncompletePaymentFound called without payment data");
  return res.status(400).json({ success: false, message: "Missing payment data" });
}

  try {
    const processedPayment = await processIncompletePayment(payment);
    logInfo(`Successfully processed incomplete payment: ${payment.identifier || "N/A"}`);
    return res.status(200).json(processedPayment);
  } catch (err: any) {
    logError(`Error processing incomplete payment ${payment?.identifier || "unknown"}`, err);
    return res.status(500).json({ 
      success: false,
      message: 'An error occurred while processing incomplete payment; please try again later' 
    });
  }
};

export const onPaymentApproval = async (req: Request, res: Response) => {
  const { paymentId } = req.body;

  if (!paymentId) {
    logWarn("onPaymentApproval called without paymentId");
    return res.status(400).json({ success: false, message: "Missing payment ID" });
  }

  try {
    const approvedPayment = await processPaymentApproval(paymentId);
    logInfo(`Payment approved successfully: ${paymentId}`);
    return res.status(200).json(approvedPayment);
  } catch (err: any) {
    logError(`Error approving payment ${paymentId}`, err);
    return res.status(500).json({
      success: false, 
      message: 'An error occurred while approving Pi payment; please try again later' 
    });
  }
};

export const onPaymentCompletion = async (req: Request, res: Response) => {
  const { paymentId, txid } = req.body;

  if (!paymentId || !txid) {
    logWarn("onPaymentCompletion called with missing paymentId or txid");
    return res.status(400).json({ success: false, message: "Missing paymentId or txid" });
  }

  try {
    const completedPayment = await processPaymentCompletion(paymentId, txid);
    logInfo(`Payment completed successfully: ${paymentId} | txid: ${txid}`);
    return res.status(200).json(completedPayment);
  } catch (err: any) {
    logError(`Error completing payment ${paymentId} | txid ${txid}`, err);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while completing Pi payment; please try again later',
    });
  }
};

export const onPaymentCancellation = async (req: Request, res: Response) => {
  const { paymentId } = req.body;

  if (!paymentId) {
    logWarn("onPaymentCancellation called without paymentId");
    return res.status(400).json({ success: false, message: "Missing payment ID" });
  }

  try {
    const cancelledPayment = await processPaymentCancellation(paymentId);
    logInfo(`Payment cancelled successfully: ${paymentId}`);
    return res.status(200).json(cancelledPayment);
  } catch (err: any) {
    logError(`Error cancelling payment ${paymentId}`, err);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while cancelling Pi payment; please try again later',
    });
  }
};

export const onPaymentError = async (req: Request, res: Response) => {
  const { paymentDTO, error } = req.body;
  
  logError(`Received Pi payment error callback`, error);
  
  if (!paymentDTO) {
    logWarn(`onPaymentError called without paymentDTO; Error: ${error}`);
    return res.status(400).json({
      success: true,
      message: `No Payment data provided for the error: ${ error }`
    })
  }

  try {
    const erroredPayment = await processPaymentError(paymentDTO);
    logInfo(`Payment error processed successfully for ${paymentDTO.identifier || "unknown"}`);
    return res.status(200).json(erroredPayment);
  } catch (err: any) {
    logError("Error processing payment error callback", err);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while processing Pi payment error; please try again later' 
    });
  } 
};