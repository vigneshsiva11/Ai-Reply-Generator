import { runJsonAgent } from "./baseAgent.js";

function getThreadContent(payload) {
  return payload.emailThreadText || payload.emailText || "";
}

function extractImportantDates(emailText) {
  const matches = emailText.match(
    /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s+\d{4})?)\b/g
  );

  return Array.from(new Set(matches || [])).slice(0, 5);
}

function extractRelevantLines(emailText) {
  return emailText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(best regards|kind regards|regards|thanks|thank you|sincerely|sent from|contact|phone|email:)/i.test(line))
    .filter((line) => !/@/.test(line))
    .filter((line) => line.length > 20)
    .slice(0, 8);
}

function toShortPhrase(line) {
  return line
    .replace(/\s+/g, " ")
    .replace(/[.;:]+$/g, "")
    .split(" ")
    .slice(0, 12)
    .join(" ")
    .trim();
}

function fallbackContext(payload) {
  const threadText = getThreadContent(payload);
  const relevantLines = extractRelevantLines(threadText);
  const complexityLevel = payload.classification?.complexityLevel || "medium";

  return {
    mainTopic: payload.subject || relevantLines[0] || "Email follow-up",
    importantDates: extractImportantDates(threadText),
    eligibilityInformation:
      complexityLevel === "high" && /eligib|requirement|criteria/i.test(threadText)
        ? "The email includes eligibility or qualification details that should be acknowledged."
        : "",
    decisionPoints: relevantLines.filter((line) => /agree|disagree|decide|reasonable|opinion|suggest|proposal|decision/i.test(line)).slice(0, 3).map(toShortPhrase),
    questionsAsked: relevantLines.filter((line) => /\?$/.test(line) || /could you|can you|what do you think|would it/i.test(line)).slice(0, 3).map(toShortPhrase),
    deadlines: extractRelevantLines(threadText).filter((line) => /deadline|due|before|last date|closing date/i.test(line)).slice(0, 3).map(toShortPhrase),
    technicalDomains: extractRelevantLines(threadText).filter((line) => /ai|ml|web|backend|frontend|api|cloud|security|data|python|javascript|react|node|java|jdk|arrow|iot|telecom/i.test(line)).slice(0, 4).map(toShortPhrase),
    requirements: relevantLines.filter((line) => /require|criteria|document|submit|complete|bring|provide/i.test(line)).slice(0, 4).map(toShortPhrase),
    requestedAction:
      relevantLines.find((line) => /reply|confirm|register|apply|submit|share|send|join|attend|complete/i.test(line)) ||
      "Reply to the sender based on the message content.",
    actionNeededFromRecipient:
      relevantLines.find((line) => /reply|confirm|register|apply|submit|share|send|join|attend/i.test(line)) ||
      "Acknowledge the message and respond appropriately.",
    keyPoints: relevantLines.slice(0, complexityLevel === "high" ? 5 : 3).map(toShortPhrase),
    constraints: ["Keep the reply concise, relevant, and professional."]
  };
}

export async function contextAgent(payload) {
  return runJsonAgent({
    agentName: "Context Agent",
    payload,
    fallback: fallbackContext,
    instructions: `
You are the Context Agent for an email reply assistant.
Return ONLY valid JSON. Do not include explanations.
Use this exact JSON shape:
{
  "mainTopic": "string",
  "decisionPoints": ["string"],
  "questionsAsked": ["string"],
  "importantDates": ["string"],
  "eligibilityInformation": "string",
  "deadlines": ["string"],
  "technicalDomains": ["string"],
  "requirements": ["string"],
  "requestedAction": "string",
  "actionNeededFromRecipient": "string",
  "keyPoints": ["string"],
  "constraints": ["string"]
}
Extract the practical context needed to write a reply. Keep points short and concrete.
Analyze the full conversation thread.
For longer or more complex emails, identify the main discussion topic, decision points, questions asked, important dates, eligibility information, deadlines, technical domains, requirements, and the action needed from the latest sender.
Behave like a summarizer, not a copier.
Limit keyPoints to the most relevant information only.
Each keyPoint must be a short phrase with at most 12 words.
Do not copy full paragraphs.
Do not include signatures, contact details, repeated sections, or long metadata.
Use double-quoted JSON keys and string values. No markdown fences.
`.trim()
  });
}
