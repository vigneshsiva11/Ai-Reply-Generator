import { runJsonAgent } from "./baseAgent.js";

function applyRegenerationPreference(baseReply, regenerateOption) {
  if (!regenerateOption) {
    return baseReply;
  }

  if (regenerateOption === "shorter") {
    const paragraphs = baseReply
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter(Boolean);

    const shortenedReply = paragraphs
      .slice(0, 2)
      .map((paragraph) => paragraph.split(/(?<=[.!?])\s+/).slice(0, 2).join(" "))
      .join("\n\n");

    return shortenedReply || baseReply;
  }

  if (regenerateOption === "more_polite") {
    return baseReply.replace(/^Hi\b/m, "Hello").replace(/\bThanks\b/g, "Thank you");
  }

  if (regenerateOption === "more_friendly") {
    return baseReply.replace(/^Hello\b/m, "Hi").replace(/\bI would\b/g, "I'd");
  }

  if (regenerateOption === "more_professional") {
    return baseReply.replace(/^Hi\b/m, "Hello").replace(/\bI'd\b/g, "I would");
  }

  return baseReply;
}

function buildReplyBody(payload) {
  const classification = payload.classification || {};
  const strategy = payload.strategy || {};
  const context = payload.context || {};
  const complexityLevel = classification.complexityLevel || "medium";
  const sender = payload.senderName || context.senderName || "there";
  const mainTopic = context.mainTopic || payload.subject || "your email";
  const keyPoints = Array.isArray(context.keyPoints) ? context.keyPoints.filter(Boolean) : [];
  const importantDates = Array.isArray(context.importantDates) ? context.importantDates.filter(Boolean) : [];
  const requirements = Array.isArray(context.requirements) ? context.requirements.filter(Boolean) : [];
  const actionNeeded = context.actionNeededFromRecipient || context.requestedAction || "";
  const deadlines = Array.isArray(context.deadlines) ? context.deadlines.filter(Boolean) : [];
  const technicalDomains = Array.isArray(context.technicalDomains) ? context.technicalDomains.filter(Boolean) : [];
  const apologyLine = classification.apologyNeeded
    ? "I am sorry for the inconvenience, and I appreciate your patience. "
    : "";
  const openingLineByStrategy = {
    confirm_receipt: `Thank you for your email about ${mainTopic}. I have received it and noted the details.`,
    ask_for_clarification: `Thank you for your email about ${mainTopic}. I would like to clarify a couple of points before responding fully.`,
    accept_invitation: `Thank you for the invitation regarding ${mainTopic}. I appreciate it and would be glad to participate.`,
    decline_politely: `Thank you for reaching out about ${mainTopic}. I appreciate the invitation, though I may not be able to participate.`,
    express_interest: `Thank you for sharing the details about ${mainTopic}. I am genuinely interested in this opportunity.`,
    provide_information: `Thank you for your email about ${mainTopic}. I am happy to share the relevant information.`,
    apologize_and_reassure: `Thank you for your email about ${mainTopic}. ${apologyLine}I want to reassure you that I am reviewing this carefully.`,
    request_extension: `Thank you for your email about ${mainTopic}. I appreciate the update and would like to request a little additional time if possible.`,
    acknowledge_information: `Thank you for your email about ${mainTopic}. I appreciate the information you shared.`,
    schedule_meeting: `Thank you for your email about ${mainTopic}. I would be glad to coordinate a meeting.`,
    follow_up_required: `Thank you for your email about ${mainTopic}. I have noted the details and will follow up on the required next steps.`
  };
  const openingLine =
    openingLineByStrategy[strategy.strategyType] ||
    `Thank you for your email about ${mainTopic}. I appreciate the context you shared.`;

  const toneHint =
    strategy.recommendedTone && strategy.recommendedTone !== classification.tone
      ? ` I will respond in a ${strategy.recommendedTone} tone as appropriate.`
      : "";

  if (complexityLevel === "low") {
    const clarificationQuestion =
      strategy.strategyType === "ask_for_clarification"
        ? " Could you please share a bit more detail so I can respond accurately?"
        : "";
    return `Hi ${sender},\n\n${openingLine}${toneHint}${clarificationQuestion}\n\nBest regards,\n[Your Name]`;
  }

  if (complexityLevel === "high") {
    const detailFragments = []
      .concat(keyPoints.slice(0, 2))
      .concat(importantDates.slice(0, 1))
      .concat(deadlines.slice(0, 1))
      .concat(technicalDomains.slice(0, 1));

    const detailsSentence = detailFragments.length
      ? ` In particular, I noted ${detailFragments.join(", ")}.`
      : "";
    const actionSentence = actionNeeded
      ? ` I understand that the main action needed is to ${actionNeeded.charAt(0).toLowerCase()}${actionNeeded.slice(1)}.`
      : "";
    const strategySentence =
      strategy.strategyType === "express_interest"
        ? " I would like to express my interest clearly and thoughtfully."
        : strategy.strategyType === "ask_for_clarification"
          ? " I would also like to clarify a few details so I can respond appropriately."
          : strategy.strategyType === "schedule_meeting"
            ? " I would be happy to coordinate the next discussion."
            : "";

    const requirementSentence =
      requirements.length ? ` I will also keep in mind ${requirements.slice(0, 2).join(" and ")}.` : "";

    return `Hi ${sender},\n\n${openingLine}${toneHint}${detailsSentence}${actionSentence}${strategySentence}${requirementSentence}\n\nI will review everything carefully and follow up with a thoughtful response on the relevant next steps.\n\nPlease let me know if there is anything additional you would like me to consider.\n\nBest regards,\n[Your Name]`;
  }

  const mediumAction =
    strategy.strategyType === "ask_for_clarification"
      ? "Before I respond fully, I would appreciate a bit more detail on the key points."
      : strategy.strategyType === "express_interest"
        ? "I am interested and would be glad to learn more about the next steps."
        : strategy.strategyType === "schedule_meeting"
          ? "I would be glad to coordinate a suitable time for the discussion."
          : "I will review the information and follow up shortly with the next steps.";

  return `Hi ${sender},\n\n${openingLine}${toneHint}\n\n${mediumAction}\n\nBest regards,\n[Your Name]`;
}

function fallbackGenerator(payload) {
  const draft = buildReplyBody(payload);

  return {
    subjectSuggestion: payload.subject || payload.context.mainTopic || "Re: Your email",
    reply: applyRegenerationPreference(draft, payload.regenerateOption),
    notes: "Fallback template generation was used because the model response was unavailable."
  };
}

export async function responseGeneratorAgent(payload) {
  return runJsonAgent({
    agentName: "Response Generator Agent",
    payload,
    fallback: fallbackGenerator,
    instructions: `
You are the Response Generator Agent for an email reply assistant.
Return ONLY valid JSON. Do not include explanations.
Use this exact JSON shape:
{
  "subjectSuggestion": "string",
  "reply": "string",
  "notes": "short explanation"
}
Write a polished reply that the user can manually review in Gmail before sending.
Do not mention AI, hidden analysis, or safety checks.
Keep it safe, professional, and aligned with the provided tone and intent.
Generate the reply by considering the entire conversation thread, while responding primarily to the latest speaker's message.
Make the writing sound natural, human, and context-aware rather than robotic or overly templated.
Use varied sentence structure and smooth transitions.
Match the wording to emotionalTone and apologyNeeded when those signals are provided.
If apologyNeeded is true, acknowledge the issue with a sincere but concise apology.
Add slight personalization by referencing the sender name, subject, main topic, or a key detail when appropriate.
Avoid stiff phrases like "I appreciate the details you shared" unless they genuinely fit the context.
Do not copy email text.
Do not repeat whole sections of the original email.
Do not include forwarded content, signature blocks, metadata, headers, long bullet lists, or schedule tables.
Summarize understanding in natural language and write the reply as a human would write.
Adjust reply depth based on classification.complexityLevel:
- low: 2 to 3 sentences
- medium: 1 paragraph
- high: 2 to 3 paragraphs that remain clean and readable
For high complexity emails, do not force the reply to be brief. Cover the main topic, important dates, requirements, and requested action when relevant.
Use strategy.strategyType and strategy.recommendedTone to shape the reply.
Examples:
- express_interest: clearly express interest
- ask_for_clarification: ask useful questions
- apologize_and_reassure: acknowledge the issue and reassure
- schedule_meeting: propose or welcome scheduling
Ensure the reply addresses the email's main topic and is not generic.
If the thread contains a question, answer it.
If the thread is a discussion, express a relevant opinion.
If the thread contains a request, acknowledge the request and address it directly.
If regenerateOption is set, adapt the reply accordingly:
- shorter: reduce explanation length
- more_polite: use more formal wording
- more_friendly: use more conversational wording
- more_professional: use more formal, polished business wording
Use double-quoted JSON keys and string values. No markdown fences.
`.trim()
  });
}
