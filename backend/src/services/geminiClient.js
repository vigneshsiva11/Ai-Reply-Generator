import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";

let geminiClient = null;
let geminiModel = null;
let geminiConnectedLogged = false;

export function getGeminiModel() {
  if (!env.geminiApiKey) {
    return null;
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(env.geminiApiKey);
  }

  if (!geminiModel) {
    geminiModel = geminiClient.getGenerativeModel({
      model: env.geminiModel
    });
  }

  if (!geminiConnectedLogged) {
    console.log("Gemini API connected successfully");
    geminiConnectedLogged = true;
  }

  return geminiModel;
}
