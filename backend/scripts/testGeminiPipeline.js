import { env } from "../src/config/env.js";
import { classifierAgent } from "../src/agents/classifierAgent.js";
import { contextAgent } from "../src/agents/contextAgent.js";
import { responseGeneratorAgent } from "../src/agents/responseGeneratorAgent.js";
import { safetyAgent } from "../src/agents/safetyAgent.js";
import { generateReply } from "../src/services/replyOrchestrator.js";

const sampleEmailInput = {
  emailText: `
Hi Priya,

I wanted to follow up on the onboarding delay for our finance team. We still do not have access to the updated reporting dashboard, and this is now blocking month-end work.

Could you please confirm the status and let us know whether this can be resolved today? If there is anything needed from our side, we are happy to help.

Thanks,
Daniel
`.trim(),
  senderName: "Daniel Carter",
  senderEmail: "daniel.carter@example.com",
  subject: "Follow-up: dashboard access delay",
  threadId: "sample-thread-001",
  regenerateOption: null
};

function printSection(title, value) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(value, null, 2));
}

function assertObject(name, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} did not return a valid JSON object.`);
  }
}

function logEnvironmentStatus() {
  console.log("Gemini integration test starting...");
  console.log(`Configured model: ${env.geminiModel}`);
  console.log(`Gemini API key configured: ${env.geminiApiKey ? "yes" : "no"}`);

  if (!env.geminiApiKey) {
    console.warn(
      "GEMINI_API_KEY is not set. This run will use fallback logic instead of live Gemini responses."
    );
  }
}

async function runPipelineTest() {
  logEnvironmentStatus();
  printSection("Sample Input", sampleEmailInput);

  const classifier = await classifierAgent(sampleEmailInput);
  assertObject("Classifier output", classifier);
  printSection("Classifier Output", classifier);

  const context = await contextAgent({
    ...sampleEmailInput,
    classification: classifier
  });
  assertObject("Context output", context);
  printSection("Context Output", context);

  const generated = await responseGeneratorAgent({
    ...sampleEmailInput,
    classification: classifier,
    context
  });
  assertObject("Generated reply output", generated);
  printSection("Generated Reply Output", generated);

  const safety = await safetyAgent({
    ...sampleEmailInput,
    classification: classifier,
    context,
    reply: generated.reply
  });
  assertObject("Safety output", safety);
  printSection("Safety Output", safety);

  const fullPipeline = await generateReply(sampleEmailInput);
  assertObject("Full pipeline output", fullPipeline);
  printSection("Full Pipeline Output", fullPipeline);

  console.log("\nPipeline test completed successfully.");
}

try {
  await runPipelineTest();
} catch (error) {
  console.error("\nPipeline test failed.");
  console.error(error);
  process.exitCode = 1;
}
