import { Request, Response } from "express";
import logger from "../../config/loggingConfig";
import processNextJob from "../../cron/jobs/a2uJobWorker";

export const a2uPaymentJobTrigger = async (req: Request, res: Response) => {
  try {
    logger.info('processing next job');
    await processNextJob();
    logger.info("✅ A2U payment worker job completed successfully.");
    return res.status(200).json({success: true, message: 'A2U payment job successfully completed'});
  } catch (error) {
    logger.error(`Controller Failed to trigger A2U payment for paymentID:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while cancelling Pi payment; please try again later',
    });
  }
};