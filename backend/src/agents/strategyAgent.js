import { runJsonAgent } from "./baseAgent.js";

function getThreadContent(payload) {
  return payload.emailThreadText || payload.emailText || "";
}

function fallbackStrategy(payload) {
  const classification = payload.classification || {};
  const emailText = getThreadContent(payload).toLowerCase();

  let strategyType = "acknowledge_information";
  if (classification.intent === "meeting_response" || emailText.includes("meeting")) {
    strategyType = "confirm_receipt";
  } else if (classification.apologyNeeded) {
    strategyType = "apologize_and_reassure";
  } else if (emailText.includes("invite") || emailText.includes("invitation")) {
    strategyType = "accept_invitation";
  } else if (emailText.includes("interested") || emailText.includes("opportunity") || emailText.includes("hackathon")) {
    strategyType = "express_interest";
  } else if (emailText.includes("clarify") || emailText.includes("more details")) {
    strategyType = "ask_for_clarification";
  } else if (emailText.includes("follow up") || emailText.includes("next steps")) {
    strategyType = "follow_up_required";
  }

  return {
    strategyType,
    recommendedTone: classification.tone || "professional",
    actionRequired: !["acknowledge_information", "confirm_receipt"].includes(strategyType),
    reasoning: "Fallback strategy selected from the email content and classification."
  };
}

export async function strategyAgent(payload) {
  return runJsonAgent({
    agentName: "Strategy Agent",
    payload,
    fallback: fallbackStrategy,
    instructions: `
You are the Strategy Agent for an email reply assistant.
Return ONLY valid JSON. Do not include explanations.
Use this exact JSON shape:
{
  "strategyType": "confirm_receipt | ask_for_clarification | accept_invitation | decline_politely | express_interest | provide_information | apologize_and_reassure | request_extension | acknowledge_information | schedule_meeting | follow_up_required",
  "recommendedTone": "string",
  "actionRequired": true,
  "reasoning": "short explanation"
}
Determine the best reply strategy based on the email content and the classification results.
Examples:
- Hackathon announcement -> express_interest
- Complaint email -> apologize_and_reassure
- Meeting invitation -> confirm_receipt
- Information email -> acknowledge_information
Select the strategy that best describes HOW the assistant should respond.
Use double-quoted JSON keys and string values. No markdown fences.
`.trim()
  });
}
