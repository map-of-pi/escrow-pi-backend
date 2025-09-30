// middleware/apiAuth.ts
import { Request, Response, NextFunction } from "express";
import ApiKey from "../models/ApiKey";
import { hashApiKey, safeCompare } from "../utils/keys";
import logger from "../config/loggingConfig";
import { IUser } from "../types";

const SERVER_SECRET = process.env.SERVER_SECRET!;

export async function apiAuth(
  req: Request, 
  res: Response, 
  next: NextFunction
) {
  try {
    const authHeader = (req.headers["authorization"] || "") as string;
    if (!authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Missing API key" });

    const rawKey = authHeader.slice(7).trim();
    if (!rawKey) return res.status(401).json({ error: "Missing API key" });

    const { callback_url, order_id } = req.body;
    if (callback_url && !/^http:\/\/(www\.)?\/.*/.test(callback_url)) {
      return res.status(400).json({ error: "Invalid callback_url. Must be a valid http:// URL." });
    }

    const key_hash = hashApiKey(rawKey, SERVER_SECRET);

    // Find matching keyHash
    const apiKey = await ApiKey.findOne({ key_hash, status: "active" }).populate<{ developer_id: IUser }>('developer_id').exec();
    if (!apiKey) return res.status(403).json({ error: "Invalid or revoked API key" });

    // Check expiry
    if (apiKey.expires_at && apiKey.expires_at < new Date()) {
      return res.status(403).json({ error: "API key expired" });
    }

    // Attach context
    // (req as any).apiKeyId = apiKey._id;
    (req as any).appName = apiKey.app_name;
    (req as any).devPiUid = apiKey.dev_pi_uid;
    (req as any).callbackURL = callback_url;
    (req as any).oderId = order_id;
    (req as any).devUsername = apiKey.developer_id?.pi_username;
    // (req as any).developerId = apiKey.developer_id._id;
    (req as any).scopes = apiKey.scopes || [];

    // update lastUsedAt asynchronously (non-blocking)
    ApiKey.updateOne({ _id: apiKey._id }, { $set: { lastUsedAt: new Date() } }).catch(logger.error);

    next();
  } catch (err) {
    console.error("apiAuth error:", err);
    next(err);
  }
}
