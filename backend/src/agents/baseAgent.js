import { getGeminiModel } from "../services/geminiClient.js";
import { safeJsonParse } from "../services/json.js";

function extractTextFromResponse(response) {
  if (typeof response?.response?.text === "function") {
    const text = response.response.text();
    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }
  }

  if (typeof response?.text === "function") {
    const text = response.text();
    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }
  }

  if (typeof response?.text === "string") {
    return response.text.trim();
  }

  return "";
}

function extractJsonCandidate(text) {
  if (!text) {
    return "";
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const objectMatches = text.match(/\{[\s\S]*\}/g);
  if (objectMatches?.length) {
    for (const candidate of objectMatches) {
      const trimmedCandidate = candidate.trim();
      if (safeJsonParse(trimmedCandidate, null)) {
        return trimmedCandidate;
      }
    }
  }

  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) {
    return text.trim();
  }

  const trailingSlices = text.slice(firstBrace).match(/\{[\s\S]*?\}/g);
  if (trailingSlices?.length) {
    for (let index = trailingSlices.length - 1; index >= 0; index -= 1) {
      const candidate = trailingSlices[index].trim();
      if (safeJsonParse(candidate, null)) {
        return candidate;
      }
    }
  }

  return text.trim();
}

export async function runJsonAgent({
  agentName,
  instructions,
  payload,
  fallback
}) {
  const model = getGeminiModel();
  const fallbackValue = typeof fallback === "function" ? fallback(payload) : fallback;

  if (!model) {
    return fallbackValue;
  }

  try {
    const prompt = [
      instructions,
      "",
      "User payload:",
      JSON.stringify(payload, null, 2),
      "",
      "Return ONLY valid JSON. Do not include explanations."
    ].join("\n");

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "text/plain"
      }
    });

    const responseText = extractTextFromResponse(response);
    const jsonCandidate = extractJsonCandidate(responseText);
    const parsed = safeJsonParse(jsonCandidate, null);

    if (!parsed || typeof parsed !== "object") {
      console.error(`${agentName} returned invalid JSON. Raw response:`, responseText);
      return fallbackValue;
    }

    return parsed;
  } catch (error) {
    console.error(`${agentName} failed:`, error);
    return fallbackValue;
  }
}
