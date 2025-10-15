import { Request, Response, NextFunction } from "express";

import { logInfo } from "../config/loggingConfig";

const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const { method, originalUrl } = req;
  const timestamp = new Date().toISOString();

  logInfo(`[${timestamp}] Incoming request: ${method} ${originalUrl}`);

  next();
};

export default requestLogger;