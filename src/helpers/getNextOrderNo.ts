// src/helpers/generateOrderNo.ts

import mongoose from "mongoose";
import { OrderCounter } from "../models/Counter";
import logger from "../config/loggingConfig";

function formatOrderNo(date: Date, seq: number) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const s = String(seq).padStart(5, "0");
  logger.info(`Formatted order number components - Year: ${y}, Month: ${m}, Day: ${d}, Seq: ${s}`);
  return `ORD-${y}${m}${d}-${s}`;  // e.g. ORD-20250226-00042
}

export async function nextOrderNo(session?: mongoose.ClientSession) {
  logger.info('Generating next order number');
  const today = new Date();
  const key = `order:${today.toISOString().slice(0,10)}`; // YYYY-MM-DD

  const doc = await OrderCounter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  ).lean();
  logger.info(`Generated new order sequence: ${doc?.seq} for key: ${key}`);

  return formatOrderNo(today, doc!.seq);
}