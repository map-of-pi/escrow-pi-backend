// models/ApiKeyUsage.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IApiKeyUsage extends Document {
  apiKey_id: Types.ObjectId;
  date: string; // YYYY-MM-DD
  requests: number;
  bytesIn?: number;
  bytesOut?: number;
}

const ApiKeyUsageSchema = new Schema<IApiKeyUsage>({
  apiKey_id: { type: Schema.Types.ObjectId, ref: "ApiKey", required: true, index: true },
  date: { type: String, required: true, index: true },
  requests: { type: Number, default: 0 },
  bytesIn: { type: Number, default: 0 },
  bytesOut: { type: Number, default: 0 }
});

ApiKeyUsageSchema.index({ apiKeyId: 1, date: 1 }, { unique: true });

export default model<IApiKeyUsage>("ApiKeyUsage", ApiKeyUsageSchema);
