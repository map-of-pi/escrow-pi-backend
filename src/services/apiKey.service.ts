import logger from "../config/loggingConfig";
import ApiKey from "../models/ApiKey";
import ApiKeyUsage from "../models/ApiKeyUsage";
import User from "../models/User";
import { env } from "../utils/env";
import { generateRawApiKey, hashApiKey } from "../utils/keys";

export const createDevApiKey = async (pi_uid:string, app_name:string, scopes:any) => {
  try {
    logger.info(`Creating dev api key for ${pi_uid} with app name ${app_name} and scopes ${scopes}`);
    let dev = await User.findOne({pi_uid}).exec()
    if (!dev) {
      throw new Error("Developer not found");
    }
    const raw = generateRawApiKey();
    const keyHash = hashApiKey(raw, env.SERVER_SECRET);

    await ApiKey.create({
      dev_pi_uid: pi_uid,
      developer_id: dev._id,
      key_hash: keyHash,
      app_name,
      expires_at: undefined,
      scopes: scopes || []
    });
    return raw
  } catch(error) {
    logger.error("service error creating dev api key", {error})
    throw new Error("service error creating dev app key")
  }
}
  
export const revokeApiKey = async (dev_pi_uid: string) => {
  try {
    await ApiKey.updateOne({ dev_pi_uid: dev_pi_uid }, { $set: { status: "revoked" } });
  } catch (error) {
    logger.error("Service Error revoking API key:", error);
    throw new Error('Failed to revoke API key');
  }
}

export const rotateApiKey = async (dev_pi_uid: string) => {
  try {
    const old = await ApiKey.findOne({ dev_pi_uid, status: "active" });
    if (!old) throw new Error("API key not found");
    // Mark old as rotated
    old.status = "rotated";
    await old.save(); 
    const raw = generateRawApiKey();
    const keyHash = hashApiKey(raw, env.SERVER_SECRET);
    await ApiKey.create({
      developer_id: old.developer_id,
      dev_pi_uid: old.dev_pi_uid,
      key_hash: keyHash,
      expires_at: old.expires_at,
      scopes: old.scopes || []
    });
    return raw;
  } catch (error) {
    logger.error("Service Error rotating API key:", error);
    throw new Error('Failed to rotate API key');
  }
}

// Return last 30 days usage
export const getApiKeyUsage = async (apiKeyId: string) => {
  try {
    // Return last 30 days usage
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    const rows = await ApiKeyUsage.find({ apiKeyId, date: { $gte: fromDate.toISOString().slice(0,10) } }).sort({ date: 1 });
    return rows;
  } catch (error) {
    logger.error("Service Error fetching API key usage:", error);
    throw new Error('Failed to fetch API key usage');
  }
}