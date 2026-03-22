import { classifierAgent } from "../agents/classifierAgent.js";
import { strategyAgent } from "../agents/strategyAgent.js";
import { contextAgent } from "../agents/contextAgent.js";
import { responseGeneratorAgent } from "../agents/responseGeneratorAgent.js";
import { safetyAgent } from "../agents/safetyAgent.js";

function buildDefaultClassification() {
  return {
    intent: "general_response",
    tone: "professional",
    emotionalTone: "neutral",
    apologyNeeded: false,
    complexityLevel: "medium",
    importanceScore: 50,
    urgency: "medium",
    confidenceScore: 0.3,
    reasoning: "Default classification used after agent failure."
  };
}

function buildDefaultStrategy(classification) {
  return {
    strategyType: classification.apologyNeeded ? "apologize_and_reassure" : "acknowledge_information",
    recommendedTone: classification.tone || "professional",
    actionRequired: classification.urgency === "high" || classification.complexityLevel === "high",
    reasoning: "Default strategy used after agent failure."
  };
}

function buildDefaultContext(input) {
  const threadText = input.emailThreadText || input.emailText || "";
  const shortSummary = threadText
    .replace(/\s+/g, " ")
    .split(" ")
    .slice(0, 12)
    .join(" ")
    .trim();

  return {
    mainTopic: input.subject || "Email follow-up",
    decisionPoints: [],
    questionsAsked: [],
    importantDates: [],
    eligibilityInformation: "",
    deadlines: [],
    technicalDomains: [],
    requirements: [],
    requestedAction: "Reply to the sender with a concise, helpful response.",
    actionNeededFromRecipient: "Acknowledge the message and respond appropriately.",
    keyPoints: [shortSummary || "email follow-up"].filter(Boolean),
    constraints: ["Keep the reply safe, concise, and professional."]
  };
}

function buildDefaultDraft(input, classification, strategy, context) {
  const greetingName = input.senderName || "there";
  const apologyLine = classification.apologyNeeded
    ? "I am sorry for the inconvenience, and I appreciate your patience. "
    : "";
  const complexityLevel = classification.complexityLevel || "medium";
  const detailedSection =
    complexityLevel === "high" && Array.isArray(context.keyPoints) && context.keyPoints.length
      ? `\n\nI have noted the main points you shared:\n${context.keyPoints.slice(0, 3).map((point) => `- ${point}`).join("\n")}`
      : "";
  const mediumBody =
    complexityLevel === "low"
      ? `Thank you for your email. I have reviewed your message and will follow up shortly.`
      : `Thank you for your email. I have reviewed your message and will follow up with the appropriate next steps shortly.`;

  return {
    subjectSuggestion: context.subject || input.subject || "Re: Your email",
    reply: `Hi ${greetingName},\n\n${apologyLine}${mediumBody}${strategy.strategyType === "express_interest" ? " I am interested and would be glad to learn more." : ""}${detailedSection}\n\nBest regards,\n[Your Name]`,
    warnings: ["Fallback draft used because one or more agents failed."]
  };
}

async function runAgentSafely(agentLabel, agentFn, payload, fallbackFactory) {
  try {
    console.log(`[reply-orchestrator] ${agentLabel} executing`);
    const result = await agentFn(payload);
    console.log(`[reply-orchestrator] ${agentLabel} succeeded`);
    if (!result || typeof result !== "object") {
      throw new Error(`${agentLabel} returned an invalid result.`);
    }
    return result;
  } catch (error) {
    console.error(`[reply-orchestrator] ${agentLabel} failed`, error);
    return fallbackFactory();
  }
}

export async function generateReply(input) {
  const classificationPayload = input;
  const classification = await runAgentSafely(
    "classifierAgent",
    classifierAgent,
    classificationPayload,
    () => buildDefaultClassification()
  );

  const strategyPayload = {
    ...input,
    classification
  };
  const strategy = await runAgentSafely(
    "strategyAgent",
    strategyAgent,
    strategyPayload,
    () => buildDefaultStrategy(classification)
  );

  const contextPayload = {
    ...input,
    classification,
    strategy
  };
  const context = await runAgentSafely(
    "contextAgent",
    contextAgent,
    contextPayload,
    () => buildDefaultContext(input)
  );

  const generatorPayload = {
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    subject: input.subject,
    threadId: input.threadId,
    regenerateOption: input.regenerateOption,
    classification,
    strategy,
    context
  };
  const generated = await runAgentSafely(
    "responseGeneratorAgent",
    responseGeneratorAgent,
    generatorPayload,
    () => buildDefaultDraft(input, classification, strategy, context)
  );

  const safetyPayload = {
    ...input,
    classification,
    strategy,
    context,
    reply: generated.reply || buildDefaultDraft(input, classification, strategy, context).reply
  };
  const safety = await runAgentSafely(
    "safetyAgent",
    safetyAgent,
    safetyPayload,
    () => ({
      approved: true,
      reply: generated.reply || buildDefaultDraft(input, classification, strategy, context).reply,
      warnings: generated.warnings || ["Safety fallback used after agent failure."]
    })
  );

  return {
    ...input,
    classification,
    strategy,
    context,
    draft: {
      subjectSuggestion: generated.subjectSuggestion || context.subject || input.subject || "Re: Your email",
      reply: safety.reply || generated.reply || buildDefaultDraft(input, classification, strategy, context).reply,
      warnings: Array.isArray(safety.warnings) ? safety.warnings : []
    }
  };
}
