import { Request, Response } from "express";
import * as ApiKeyService from "../services/apiKey.service";
import { IUser } from "../types";


export const createDevApiKey = async (req:Request, res:Response) => {
  try {
    const currentUser = req.currentUser as IUser;

    const {app_name, scopes } = req.body;
    const devKey = await ApiKeyService.createDevApiKey(currentUser?.pi_uid, app_name, scopes)

    // Return raw key only once. Save raw key to a one-time secure storage if you want to show again.
    res.json({ api_key: devKey, note: "Save this value now. It won't be shown again." });
  } catch (error) {
    console.error("Controller Error creating developer:", error);
    return res.status(500).json({ message: 'Failed to create developer' });
  }
}

export const revokeApiKey = async (req:Request, res:Response) => {
  try {
    // const currentUser = req.currentUser as IUser;

    const { pi_uid } = req.body;
    await ApiKeyService.revokeApiKey(pi_uid);
    return res.json({ success: true });
  } catch (error) {
    console.error("Controller Error creating developer:", error);
    return res.status(500).json({ message: 'Failed to create developer' });
  }
}

export const rotateApiKey = async (req:Request, res:Response) => {
  try {
    const currentUser = req.currentUser as IUser;
    const devKey = await ApiKeyService.rotateApiKey(currentUser?.pi_uid);
    // Return raw key only once. Save raw key to a one-time secure storage if you want to show again.
    res.json({ apiKey: devKey, note: "Save this value now. It won't be shown again." });
  } catch (error) {
    console.error("Controller Error creating developer:", error);
    return res.status(500).json({ message: 'Failed to create developer' });
  }
}

export const getApiKeyUsage = async (req:Request, res:Response) => {
  try {
    const { apiKeyId } = req.params;
    const apiUsage = await ApiKeyService.getApiKeyUsage(apiKeyId);
    res.status(200).json(apiUsage);
  } catch (error) {
    console.error("Controller Error creating developer:", error);
    return res.status(500).json({ message: 'Failed to create developer' });
  }
}

export const testApiKey = (req:Request, res:Response) => {
  try {
    res.status(200).json({ 
      message: "API key is valid", 
      appName: (req as any).appName,
      api_url: "http://localhost:4300",
      devUsername: (req as any).devUsername,
      order_id: (req as any).oderId|| "123a",
      callback_url: (req as any).callbackURL || "http://localhost:3000/callback",
    });
  } catch (error) {
    console.error("Controller Error testing API key:", error);
    return res.status(500).json({ message: 'Failed to test API key' });
  }
  
}