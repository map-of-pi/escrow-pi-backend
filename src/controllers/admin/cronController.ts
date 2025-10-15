import { Request, Response } from "express";
import { logInfo, logError } from "../../config/loggingConfig";
import processNextJob from "../../cron/jobs/a2uJobWorker";

export const a2uPaymentJobTrigger = async (req: Request, res: Response) => {
  try {
    logInfo("Processing next A2U payment job...");
    await processNextJob();
    logInfo("✅ A2U payment job completed successfully.");
    return res.status(200).json({success: true, message: 'A2U payment job completed successfully'});
  } catch (err: any) {
    logError("❌ Controller failed to trigger A2U payment job", err);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while processing A2U payment; please try again later.',
    });
  }
};