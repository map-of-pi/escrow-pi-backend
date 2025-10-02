import {Document, Types} from "mongoose";
import { PaymentType } from "./models/enums/paymentType";
import { TransactionEnum } from "./models/enums/transactionEnum";

// ========================
// USER MODELS
// ========================
export interface IUser extends Document {
  pi_uid: string;
  pi_username: string;
  user_name: string;
};

export interface IComment extends Document {
  comment: string;
  transaction_id: string;
}

export interface ITransaction extends Document {
  sender: Types.ObjectId;
  sender_pi_uid: string;
  receiver: Types.ObjectId;
  receiver_pi_uid: string;
  amount: number;
  status: TransactionEnum;
  order_id: string;
  a2u_payment_id: string;
  u2a_payment_id: string;
  u2a_txid: string;
  a2u_txid: string;
}

export interface IPayment extends Document {
  user_id: Types.ObjectId;
  pi_payment_id: string;
  amount: Types.Decimal128;
  paid: boolean;
  memo: string;
  txid?: string;
  payment_type: PaymentType;
  cancelled: boolean;
  createdAt: Date;
};


export interface U2AMetadata {
  payment_type: PaymentType;
}

export interface A2UMetadata { 
  orderId: string; 
  sellerId: string; 
  buyerId: string 
};

export interface PaymentInfo {
  identifier: string;
  transaction?: {
    txid: string;
    _link: string;
  };
};

export interface PaymentDTO {
  amount: number;
  user_uid: string;
  created_at: string;
  identifier: string;
  memo: string;
  metadata: U2AMetadata | A2UMetadata;
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  },
  to_address: string;
  transaction: null | {
    txid: string;
    verified: boolean;
    _link: string;
  },
};

export interface IA2UJob extends Document {
  sellerPiUid: string;
  amount: number;
  xRef_ids: string[];
  memo: string,
  status: 'pending' | 'processing' | 'completed' | 'failed';
  last_a2u_date: Date,
  attempts: number;
  last_error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface A2UPaymentDataType {
  sellerPiUid: string,
  amount: string,
  xRefIds: string[],
  memo: string
};