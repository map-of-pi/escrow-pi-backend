// src/helpers/generateOrderNo.ts

import mongoose from "mongoose";
import { logInfo, logWarn, logError } from "../config/loggingConfig";
import { OrderCounter } from "../models/Counter";

function formatOrderNo(date: Date, seq: number) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const s = String(seq).padStart(5, "0");

  logInfo(`Formatted order number components — Year: ${y}, Month: ${m}, Day: ${d}, Seq: ${s}`);
  return `ORD-${y}${m}${d}-${s}`;  // e.g. ORD-20250226-00042
}

export async function nextOrderNo(session?: mongoose.ClientSession) {
  const today = new Date();
  const key = `order:${today.toISOString().slice(0,10)}`; // YYYY-MM-DD

  logInfo(`Generating next order number for key: ${key}`);
  try {
    const doc = await OrderCounter.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    ).lean();

    if (!doc) {
      logWarn(`OrderCounter document not found or created for key: ${key}`);
      throw new Error("Order sequence document could not be generated");
    }
    logInfo(`Generated new order sequence: ${doc.seq} for key: ${key}`);
    return formatOrderNo(today, doc!.seq);
  } catch (err: any) {
    logError(`Failed to generate next order number for key ${key}: ${err.message}`);
    throw err;
  }
}