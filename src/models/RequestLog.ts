// models/RequestLog.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IRequestLog extends Document {
  apiKey_id?: Types.ObjectId;
  developer_id?: Types.ObjectId;
  method: string;
  path: string;
  status: number;
  latencyMs: number;
  timestamp: Date;
  ip?: string;
  user_agent?: string;
  body_sample?: any; // small - avoid PII
}

const RequestLogSchema = new Schema<IRequestLog>({
  apiKey_id: { type: Schema.Types.ObjectId, ref: "ApiKey" },
  developer_id: { type: Schema.Types.ObjectId, ref: "Developer" },
  method: String,
  path: String,
  status: Number,
  latencyMs: Number,
  timestamp: { type: Date, default: () => new Date() },
  ip: String,
  user_agent: String,
  body_sample: Schema.Types.Mixed
});

export default model<IRequestLog>("RequestLog", RequestLogSchema);
