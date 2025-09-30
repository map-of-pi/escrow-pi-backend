// routes/adminApiKeys.ts
import {Router} from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { revokeApiKey, createDevApiKey, rotateApiKey, testApiKey } from "../controllers/apiKeyController";
import { isApiKeyFound } from "../middlewares/isApiKeyFound";
import { apiAuth } from "../middlewares/apiAuth";

const ApiServiceRouter = Router();
ApiServiceRouter.post("/test", apiAuth, testApiKey);
// Generate API key for developer
ApiServiceRouter.post("/generate", verifyToken, isApiKeyFound, createDevApiKey);

// Revoke
ApiServiceRouter.post("/revoke", verifyToken, revokeApiKey);

// Rotate (generate new key, mark old as rotated)
ApiServiceRouter.post("/rotate", verifyToken, rotateApiKey);

// Usage report for key/dev
ApiServiceRouter.get("/usage/:apiKeyId", verifyToken)

export default ApiServiceRouter;
