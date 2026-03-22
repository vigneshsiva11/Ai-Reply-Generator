import { runJsonAgent } from "./baseAgent.js";

function getThreadContent(payload) {
  return payload.emailThreadText || payload.emailText || "";
}

function detectComplexityLevel(payload) {
  const emailText = getThreadContent(payload);
  const normalizedText = emailText.toLowerCase();
  const paragraphs = emailText
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const bulletCount = (emailText.match(/^\s*[-*•]\s+/gm) || []).length;
  const numberedCount = (emailText.match(/^\s*\d+\.\s+/gm) || []).length;
  const dateCount = (
    emailText.match(
      /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,\s+\d{4})?)\b/gi
    ) || []
  ).length;
  const scheduleKeywords = ["schedule", "timeline", "agenda", "date", "time", "deadline", "eligibility"];
  const technicalKeywords = ["api", "integration", "technical", "requirements", "criteria", "architecture", "stack"];
  const hasStructuredSignals =
    bulletCount > 0 ||
    numberedCount > 0 ||
    dateCount > 0 ||
    scheduleKeywords.some((keyword) => normalizedText.includes(keyword)) ||
    technicalKeywords.some((keyword) => normalizedText.includes(keyword));

  if (
    hasStructuredSignals ||
    emailText.length > 1200 ||
    paragraphs.length >= 4
  ) {
    return "high";
  }

  if (emailText.length < 280 && paragraphs.length <= 1 && bulletCount === 0 && numberedCount === 0) {
    return "low";
  }

  return "medium";
}

function detectImportanceScore(payload) {
  const emailText = getThreadContent(payload);
  const normalizedText = emailText.toLowerCase();
  let score = 45;

  if (emailText.length > 1200) score += 10;
  if ((emailText.match(/^\s*[-*â€¢]\s+/gm) || []).length > 0) score += 10;
  if ((emailText.match(/^\s*\d+\.\s+/gm) || []).length > 0) score += 8;
  if (/\bdeadline|due|urgent|asap|official|announcement|requirements|eligibility|schedule|project\b/i.test(normalizedText)) {
    score += 20;
  }
  if (/\bmeeting confirmation|thanks|thank you|received\b/i.test(normalizedText)) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

function fallbackClassifier(payload) {
  const emailText = getThreadContent(payload).toLowerCase();

  let urgency = "medium";
  if (
    emailText.includes("urgent") ||
    emailText.includes("asap") ||
    emailText.includes("today") ||
    emailText.includes("immediately") ||
    emailText.includes("by end of day")
  ) urgency = "high";
  if (emailText.includes("whenever") || emailText.includes("no rush") || emailText.includes("next week")) urgency = "low";

  let intent = "general_response";
  if (
    emailText.includes("hackathon") ||
    emailText.includes("event invitation") ||
    emailText.includes("opportunity announcement") ||
    emailText.includes("opportunity") ||
    emailText.includes("invited to participate")
  ) intent = "express_interest";
  if (emailText.includes("meeting")) intent = "meeting_response";
  if (emailText.includes("invoice") || emailText.includes("payment")) intent = "billing_response";
  if (emailText.includes("review") || emailText.includes("feedback")) intent = "feedback_response";
  if ((emailText.includes("thanks") || emailText.includes("thank you")) && intent === "general_response") intent = "gratitude_response";

  let tone = "professional";
  if (emailText.includes("happy") || emailText.includes("excited")) tone = "friendly";
  if (emailText.includes("complaint") || emailText.includes("issue") || emailText.includes("problem")) tone = "calm";

  let emotionalTone = "neutral";
  if (emailText.includes("frustrated") || emailText.includes("disappointed") || emailText.includes("upset")) emotionalTone = "frustrated";
  if (emailText.includes("happy") || emailText.includes("excited") || emailText.includes("glad")) emotionalTone = "positive";
  if (emailText.includes("worried") || emailText.includes("concerned")) emotionalTone = "concerned";

  const apologyNeeded =
    emailText.includes("issue") ||
    emailText.includes("problem") ||
    emailText.includes("delay") ||
    emailText.includes("frustrated") ||
    emailText.includes("disappointed");

  return {
    intent,
    tone,
    emotionalTone,
    apologyNeeded,
    complexityLevel: detectComplexityLevel(payload),
    importanceScore: detectImportanceScore(payload),
    urgency,
    confidenceScore: 0.62,
    reasoning: "Fallback heuristic classification was used because the model response was unavailable."
  };
}

export async function classifierAgent(payload) {
  return runJsonAgent({
    agentName: "Classifier Agent",
    payload,
    fallback: fallbackClassifier,
    instructions: `
You are the Classifier Agent for an email reply assistant.
Return ONLY valid JSON. Do not include explanations.
Use this exact JSON shape:
{
  "intent": "string",
  "tone": "professional | friendly | polite | empathetic | calm | assertive",
  "emotionalTone": "neutral | positive | frustrated | concerned | disappointed | appreciative | angry",
  "apologyNeeded": true,
  "complexityLevel": "low | medium | high",
  "importanceScore": 0,
  "urgency": "low | medium | high",
  "confidenceScore": 0.0,
  "reasoning": "short explanation"
}
Infer the most suitable reply tone automatically from the email. Do not ask the user.
Analyze the full conversation context, not just the latest message.
Detect discussion intent, agreement or disagreement, requests for opinion, and requests for action across the thread.
Detect the sender's emotional tone from the message wording.
Set apologyNeeded to true when the sender reports a mistake, delay, issue, frustration, inconvenience, or complaint.
Assess urgency using explicit deadlines, escalation language, and time-sensitive asks, not just the presence of "urgent".
If the email is an event invitation, hackathon announcement, or opportunity announcement, use intent "express_interest".
Determine complexityLevel from message length, paragraph count, bullet points, dates, schedules, eligibility criteria, technical details, and the amount of structured information.
Use "low" for short, simple asks like meeting confirmations.
Use "medium" for normal discussion emails with some context.
Use "high" for structured announcements, multi-point requests, schedules, eligibility criteria, or technically detailed messages.
Set importanceScore from 0 to 100 based on deadlines, official announcements, project requirements, schedule details, eligibility criteria, and overall significance.
confidenceScore must be a number between 0 and 1.
Use double-quoted JSON keys and string values. No markdown fences.
`.trim()
  });
}
