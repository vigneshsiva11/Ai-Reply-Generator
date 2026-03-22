import cors from "cors";
import express from "express";
import { replyRoutes } from "./routes/replyRoutes.js";

const requestBuckets = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;

function rateLimitMiddleware(req, res, next) {
  const key = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();
  const bucket = requestBuckets.get(key) || {
    count: 0,
    windowStart: now
  };

  if (now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    bucket.count = 0;
    bucket.windowStart = now;
  }

  bucket.count += 1;
  requestBuckets.set(key, bucket);

  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    console.warn(`[rate-limit] blocked request from ${key}`);
    return res.status(429).json({
      success: false,
      error: "Too many requests. Please try again in a minute."
    });
  }

  return next();
}

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      optionsSuccessStatus: 200
    })
  );
  app.options("*", cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimitMiddleware);

  app.get("/health", (req, res) => {
    res.json({
      ok: true
    });
  });

  app.use("/api/reply", replyRoutes);

  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error."
    });
  });

  return app;
}
