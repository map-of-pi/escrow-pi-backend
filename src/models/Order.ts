// src/models/Order.ts
import mongoose, { Schema, InferSchemaType } from "mongoose";
import { OrderStatusEnum } from "./enums/orderStatusEnum";

const OrderSchema = new Schema(
  {
    sender_id: { type: Schema.Types.ObjectId, required: true, index: true, ref: "User" },
    receiver_id: { type: Schema.Types.ObjectId, required: true, index: true, ref: "User" },
    sender_username: { type: String, required: true },
    receiver_username: { type: String, required: true },
    amount: { type: Number, required: true, default: 0.0 },
    order_no: { type: String, unique: true, required: true, index: true }, // public ID
    status: {
      type: String,
      enum: Object.values(OrderStatusEnum).filter(
        (value) => typeof value === "string"
      ),
      default: OrderStatusEnum.Initiated,
    },
    u2a_payment_id: {
      type: String,
      unique: true,
      sparse: true,
    },
    a2u_payment_id: {
      type: String,
      unique: true,
      sparse: true,
    },
    u2a_completed_at: {
      type: Date,
      required: false,
    },
    a2u_completed_at: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);

// Compound uniqueness: no duplicate (u2a_payment_id + a2u_payment_id) across docs
OrderSchema.index(
  { u2a_payment_id: 1, a2u_payment_id: 1 },
  { unique: true, sparse: true }
);

// Validation: inside the same document, they must differ
OrderSchema.pre("validate", function (next) {
  if (
    this.u2a_payment_id &&
    this.a2u_payment_id &&
    this.u2a_payment_id === this.a2u_payment_id
  ) {
    return next(
      new Error("u2a_payment_id and a2u_payment_id must not be the same.")
    );
  }
  next();
});

export type OrderType = InferSchemaType<typeof OrderSchema>;
export const Order = mongoose.model("Order", OrderSchema);
