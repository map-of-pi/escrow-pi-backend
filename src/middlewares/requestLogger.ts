// middleware/requestLogger.ts
import { Request, Response, NextFunction } from "express";
import RequestLog from "../models/RequestLog";
import ApiKeyUsage from "../models/ApiKeyUsage";
import logger from "../config/loggingConfig";

export async function requestLogger(
  req: Request, 
  res: Response, 
  next: NextFunction
) {
  const start = Date.now();

  // Hook into finish
  res.on("finish", async () => {
    try {
      const latency = Date.now() - start;
      const apiKeyId = (req as any).apiKeyId;
      const developerId = (req as any).developerId;
      const log = {
        apiKeyId,
        developerId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        latencyMs: latency,
        ip: req.ip || (req.headers["x-forwarded-for"] as string) || undefined,
        userAgent: req.headers["user-agent"],
        timestamp: new Date()
      };

      // Save log (consider sampling or write to a log queue)
      RequestLog.create(log).catch(logger.error);

      // Increment daily usage counter (atomic upsert)
      if (apiKeyId) {
        const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        await ApiKeyUsage.updateOne(
          { apiKeyId, date },
          { $inc: { requests: 1 } },
          { upsert: true }
        ).catch(logger.error);
      }
    } catch (err) {
      logger.error("requestLogger error:", {err});
    }
  });

  next();
}
