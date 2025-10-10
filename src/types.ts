import {Document, Types} from "mongoose";
import { PaymentType } from "./models/enums/paymentType";
import { OrderStatusEnum } from "./models/enums/orderStatusEnum";

// ========================
// USER MODELS
// ========================
export interface IUser extends Document {
  pi_uid: string;
  pi_username: string;
  user_name: string;
};

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
  orderType: OrderStatusEnum;
  order_no: string
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

export interface A2UPaymentDataType {
  senderPiUid: string,
  receiverPiUid: string,
  amount: string,
  orderIds: string[],
  memo: string
};

export interface PaymentDTO {
  amount: number;
  user_uid: string;
  created_at: string;
  identifier: string;
  memo: string;
  metadata: {
    [key: string]: any;
  };
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

// ========================
// NOTIFICATION
// ========================
export interface INotification extends Document {
  _id: string;
  pi_uid: string;
  is_cleared: boolean;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface IA2UJob extends Document {
  receiverPiUid: string;
  senderPiUid: string;
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