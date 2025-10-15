import schedule from "node-schedule";
import { logInfo, logError } from "../config/loggingConfig";
import processNextJob from "./jobs/a2uJobWorker";

export const scheduleCronJobs = () => {
  logInfo("⏳ Initializing scheduled cron jobs..");

  // Drain A2U payment queue every 5 min
  const a2uPaymentJobTime = '0 */5 * * * *'; // Every 5 minutes

  schedule.scheduleJob(a2uPaymentJobTime, async () => {
    const timestamp = new Date().toISOString();
    logInfo(`🕒 A2U payment worker job triggered at ${timestamp}`);

    try {
      await processNextJob();
      logInfo("✅ A2U payment worker job completed successfully.");
    } catch (err: any) {
      logError(`❌ A2U payment worker job failed: ${err.message}`);
    }
  });

  logInfo("✅ All cron jobs have been scheduled successfully.");
};
