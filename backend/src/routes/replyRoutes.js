import express from "express";
import { generateReply } from "../services/replyOrchestrator.js";

const router = express.Router();

function validatePayload(body) {
  const emailThreadText = body.emailThreadText || body.emailText || "";

  return {
    emailThreadText,
    emailText: emailThreadText,
    senderName: body.senderName || "",
    senderEmail: body.senderEmail || "",
    subject: body.subject || "",
    threadId: body.threadId || "",
    regenerateOption: body.regenerateOption || null
  };
}

router.post("/generate", async (req, res, next) => {
  try {
    console.log("POST /api/reply/generate");
    const payload = validatePayload(req.body);

    if (!payload.emailThreadText.trim()) {
      return res.status(400).json({
        error: "emailThreadText is required."
      });
    }

    const result = await generateReply(payload);

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return next(error);
  }
});

export { router as replyRoutes };
