import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number.parseInt(process.env.PORT || "4000", 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "*",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash"
};
