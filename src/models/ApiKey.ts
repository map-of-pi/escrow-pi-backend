// models/ApiKey.ts
import { Schema, model, Document, Types } from "mongoose";

export type ApiKeyStatus = "active" | "revoked" | "rotated";

export interface IApiKey extends Document {
  dev_pi_uid: string;
  developer_id: Types.ObjectId;
  key_hash: string; // HMAC-SHA256(rawKey, SERVER_SECRET)
  status: ApiKeyStatus;
  app_name: string;
  createdAt: Date;
  last_used_at?: Date;
  expires_at?: Date;
  scopes?: string[]; // e.g., ["transactions:read","transactions:write"]
  meta?: Record<string, any>;
}

const ApiKeySchema = new Schema<IApiKey>({
  dev_pi_uid: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  developer_id: { 
    type: Schema.Types.ObjectId, 
    ref: "User", 
    required: true, 
    unique: true,
    index: true 
  },
  key_hash: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  status: { 
    type: String, 
    enum: ["active", "revoked", "rotated"], 
    default: "active" 
  },
  app_name: {
    type: String,
    required: true
  },
  last_used_at: Date,
  expires_at: Date,
  scopes: [String],
  meta: Schema.Types.Mixed
},
{ timestamps: true });

export default model<IApiKey>("ApiKey", ApiKeySchema);
