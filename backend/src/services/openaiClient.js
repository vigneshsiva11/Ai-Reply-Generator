import OpenAI from "openai";
import { env } from "../config/env.js";

let openAiClient = null;

export function getOpenAiClient() {
  if (!env.openAiApiKey) {
    return null;
  }

  if (!openAiClient) {
    openAiClient = new OpenAI({
      apiKey: env.openAiApiKey
    });
  }

  return openAiClient;
}
