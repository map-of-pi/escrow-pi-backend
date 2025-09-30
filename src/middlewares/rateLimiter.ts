// // middleware/rateLimiter.ts
// import { Request, Response, NextFunction } from "express";
// import Redis from "ioredis";

// const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

// // Config per-key default
// const DEFAULT_RATE = {
//   capacity: 1000,         // tokens (max requests)
//   refillTokens: 1000,     // tokens added each interval
//   refillIntervalSec: 86400 // every day -> daily quota
// };

// // Lua script for token bucket
// const LUA_TOKEN_BUCKET = `
// local key = KEYS[1]
// local capacity = tonumber(ARGV[1])
// local refill_tokens = tonumber(ARGV[2])
// local refill_interval = tonumber(ARGV[3])
// local now = tonumber(ARGV[4])
// local requested = tonumber(ARGV[5])

// local data = redis.call("HMGET", key, "tokens", "last_refill")
// local tokens = tonumber(data[1])
// local last_refill = tonumber(data[2])

// if not tokens then
//   tokens = capacity
//   last_refill = now
// end

// -- refill
// local elapsed = math.max(0, now - last_refill)
// if elapsed >= refill_interval then
//   tokens = math.min(capacity, tokens + refill_tokens * math.floor(elapsed / refill_interval))
//   last_refill = now
// end

// local allowed = 0
// if tokens >= requested then
//   tokens = tokens - requested
//   allowed = 1
// end

// redis.call("HMSET", key, "tokens", tokens, "last_refill", last_refill)
// redis.call("EXPIRE", key, math.ceil(refill_interval * 2))

// return {allowed, tokens}
// `;

// export function rateLimiterFactory(options?: Partial<typeof DEFAULT_RATE>) {
//   const cfg = { ...DEFAULT_RATE, ...(options || {}) };

//   return async function rateLimiter(req: Request, res: Response, next: NextFunction) {
//     try {
//       const apiKeyId = (req as any).apiKeyId;
//       if (!apiKeyId) {
//         return res.status(500).json({ error: "RateLimiter: missing apiKeyId on request" });
//       }
//       // You could customize per-key quotas by querying DB for apiKeyId scopes/meta
//       // For performance, you might cache per-key config in Redis or an LRU in memory
//       const key = `ratelimit:${apiKeyId.toString()}`;
//       const now = Math.floor(Date.now() / 1000);

//       const result = await redis.eval(LUA_TOKEN_BUCKET, 1, key, cfg.capacity, cfg.refillTokens, cfg.refillIntervalSec, now, 1);
//       const allowed = result[0] === 1;
//       const tokensLeft = result[1];

//       res.setHeader("X-RateLimit-Limit", cfg.capacity);
//       res.setHeader("X-RateLimit-Remaining", tokensLeft);
//       // Optionally set X-RateLimit-Reset to seconds until refill
//       if (!allowed) {
//         return res.status(429).json({ error: "Rate limit exceeded" });
//       }
//       next();
//     } catch (err) {
//       console.error("Rate limiter error:", err);
//       // If Redis is down: choose fail-open (allow) or fail-closed (deny). We'll fail-open but log alert.
//       // For strict security: return 503
//       next();
//     }
//   };
// }
