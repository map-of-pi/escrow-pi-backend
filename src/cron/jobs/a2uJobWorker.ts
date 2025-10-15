import { logInfo, logWarn, logError } from "../../config/loggingConfig";
import A2UPaymentQueue from "../../models/A2UPaymentQueue";
import { createA2UPayment } from "../../services/payment.service";

// workers/mongodbA2UWorker.ts
async function processNextJob(): Promise<void> {
  logInfo("🚀 Starting next A2U payment job..");
  const now = new Date();
  const MAX_ATTEMPT = 3

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  // Find the next job ready for processing
  const job = await A2UPaymentQueue.findOneAndUpdate(
    {
      $or: [
        { status: 'pending' },
        { status: 'failed' },
        {
          status: 'batching',
          last_a2u_date: { $lte: threeDaysAgo }
        }
      ],
      attempts: { $lt: 3 }
    },
    {
      status: 'processing',
      $inc: { attempts: 1 },
      updatedAt: new Date(),
    },
    {
      sort: { updatedAt: 1 },
      new: true,
    }
  );

  if (!job) {
    logInfo("No pending A2U jobs found in queue.");
    return;
  }

  const { receiverPiUid, senderPiUid, amount, xRef_ids, _id, attempts, memo } = job;

  try {
    logInfo(`[→] Processing A2U payment (Attempt ${attempts}/${MAX_ATTEMPT}) for receiver ${receiverPiUid}`);

    const completedpayment = await createA2UPayment({
      receiverPiUid: receiverPiUid,
      amount: amount.toString(),
      memo: memo,
      orderIds: xRef_ids,
      senderPiUid:senderPiUid
    })

    if (!completedpayment) {
      throw new Error('Failed to create new A2U payment');
    }

    await A2UPaymentQueue.findByIdAndUpdate(_id, {
      status: 'completed',
      updatedAt: new Date(),
      last_a2u_date: new Date(),
      last_error: null,
    });

    logInfo(`[✔] A2U payment successfully completed for ${receiverPiUid}`);
  } catch (err: any) {
    const errorMsg = err.message || "Unknown error occurred";

    logError(`❌ A2U payment job encountered an error: ${errorMsg}`);

    const willRetry = attempts < MAX_ATTEMPT;

    await A2UPaymentQueue.findByIdAndUpdate(_id, {
      status: willRetry ? 'pending' : 'failed',
      last_error: err.message,
      updatedAt: new Date(),
    });

    logError(`[✘] A2U payment failed for ${receiverPiUid}: ${err.message}`);
    
    if (willRetry) {
      logWarn(`[↻] Retrying job for ${receiverPiUid} (Attempt ${attempts}/${MAX_ATTEMPT})`);
    } else {
      logError(`[⚠️] Job permanently failed after ${attempts} attempts for ${receiverPiUid}`);
    }
  }
};

export default processNextJob;