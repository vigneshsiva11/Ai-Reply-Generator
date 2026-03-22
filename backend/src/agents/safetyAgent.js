import { runJsonAgent } from "./baseAgent.js";

function fallbackSafety(payload) {
  const cleanedReply = (payload.reply || "")
    .replace(/\bguarantee\b/gi, "aim")
    .replace(/\bimmediately\b/gi, "as soon as possible");
  const warnings = [];

  let finalReply = cleanedReply.trim();

  if (!/^hi\b|^hello\b|^dear\b/i.test(finalReply)) {
    finalReply = `Hello,\n\n${finalReply}`;
    warnings.push("Greeting was added for professionalism.");
  }

  if (!/best regards|kind regards|sincerely|thank you/i.test(finalReply)) {
    finalReply = `${finalReply}\n\nBest regards,\n[Your Name]`;
    warnings.push("Closing was added for professionalism.");
  }

  return {
    approved: true,
    reply: finalReply,
    warnings
  };
}

export async function safetyAgent(payload) {
  return runJsonAgent({
    agentName: "Safety Agent",
    payload,
    fallback: fallbackSafety,
    instructions: `
You are the Safety Agent for an email reply assistant.
Return ONLY valid JSON. Do not include explanations.
Use this exact JSON shape:
{
  "approved": true,
  "reply": "string",
  "warnings": ["string"]
}
Review the draft for professionalism, safety, overpromising, hostility, privacy issues, or inappropriate language.
Check for over-promising, incorrect commitments, informal language in formal emails, missing greeting, and missing closing.
If needed, rewrite the reply to be safer and more professional while preserving intent.
Always return the final sanitized reply in the "reply" field.
Use double-quoted JSON keys and string values. No markdown fences.
`.trim()
  });
}
