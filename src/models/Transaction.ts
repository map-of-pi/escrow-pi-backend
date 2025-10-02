// import mongoose, { Schema, SchemaTypes } from "mongoose";
// import { ITransaction } from "../types";
// import { TransactionEnum } from "./enums/transactionEnum";

// const TransactionSchema = new Schema<ITransaction>(
//   {
//     sender: { 
//       type: SchemaTypes.ObjectId, 
//       required: true 
//     },
//     sender_pi_uid: {
//       type: String,
//       require: true
//     },
//     receiver: {
//       type: SchemaTypes.ObjectId,
//       require: true
//     },
//     receiver_pi_uid: {
//       type: String,
//       require: true
//     },
//     amount: { 
//       type: Number, 
//       required: true 
//     },
//     xRef_ids: [{ type: String, required: true }],
//     memo: { type: String, require: true },
//     status: {
//       type: String,
//       enum: TransactionEnum,
//       default: TransactionEnum.Initiated,
//     },
//     last_a2u_date: { type: Date, default: null },
//     attempts: { type: Number, default: 0 },
//     last_error: { type: String, default: null }
//   },
//   { timestamps: true }
// );

// const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
// export default Transaction;