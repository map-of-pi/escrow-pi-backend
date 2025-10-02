// src/models/Order.ts
import mongoose, { Schema, InferSchemaType } from "mongoose";

const CommentSchema = new Schema({
  description: { type: String, default: "" },
  order_no: { type: String, required: true, index: true },
  order_id: { type: Schema.Types.ObjectId, required: true, index: true, ref: "Order" }
}, { timestamps: true });

export type CommenType = InferSchemaType<typeof CommentSchema>;
export const Comment = mongoose.model("Comment", CommentSchema);