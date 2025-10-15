import mongoose from "mongoose";
import crypto from "crypto";
import { logInfo, logWarn, logError } from "../config/loggingConfig";
import { OrderCounter } from "../models/Counter";

/**
 * Generate a short, unique, human-readable order number.
 * Format example: ORD-25YH9Q8T
 */
function generateShortCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // skip ambiguous chars
  let result = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
};

/**
 * Generates an industry-standard order number (like Stripe/Shopify style)
 * Example output: ORD-25YH9Q8T
 */
export async function nextOrderNo(session?: mongoose.ClientSession) {
  try {
    const now = new Date();
    const yearSuffix = now.getFullYear().toString().slice(-2);
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
    )
      .toString()
      .padStart(3, "0"); // e.g. 286th day

    const shortCode = generateShortCode(6);
    const orderNo = `ORD-${yearSuffix}${dayOfYear}${shortCode}`;

    // Optional: maintain sequence per day if you need audit or strict ordering
    await OrderCounter.findOneAndUpdate(
      { key: `order:${now.toISOString().slice(0, 10)}` },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );

    logInfo(`Generated new order number: ${orderNo}`);
    return orderNo;
  } catch (err: any) {
    logError(`❌ Failed to generate new order number: ${err.message}`, {
      stack: err.stack,
    });
    throw err;
  }
};
