// src/models/Counter.ts
import mongoose, { Schema } from "mongoose";

const CounterSchema = new Schema({
  key: { type: String, unique: true },  // e.g. "order:2025-02-26"
  seq: { type: Number, default: 0 }
}, { versionKey: false });

export const OrderCounter = mongoose.model("OrderCounter", CounterSchema);