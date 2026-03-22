import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { replyRoutes } from "./routes/replyRoutes.js";

const requestBuckets = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const ALLOWED_ORIGINS = new Set([
  "https://mail.google.com",
  "http://localhost:3000",
  "http://localhost:4000",
  "http://127.0.0.1:4000"
]);

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (origin.startsWith("chrome-extension://")) {
    return true;
  }

  if (env.frontendOrigin !== "*" && origin === env.frontendOrigin) {
    return true;
  }

  return ALLOWED_ORIGINS.has(origin);
}

function applyCorsHeaders(req, res) {
  const origin = req.headers.origin;

  if (origin && isAllowedOrigin(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
  }

  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Max-Age", "86400");
  res.header("Access-Control-Allow-Private-Network", "true");
}

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
  const corsMiddleware = cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin || "unknown"}`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    optionsSuccessStatus: 200
  });

  app.use((req, res, next) => {
    applyCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    return next();
  });
  app.options("*", (req, res) => {
    applyCorsHeaders(req, res);
    res.sendStatus(200);
  });
  app.use(corsMiddleware);
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
