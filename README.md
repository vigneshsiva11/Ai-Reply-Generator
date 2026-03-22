# Gmail AI Reply Generator

A Gmail Chrome extension and Node.js backend that generates context-aware email replies using a multi-agent orchestration pipeline powered by Google Gemini.

The project injects an `AI Reply` button directly into Gmail compose and reply toolbars, extracts the visible conversation thread, sends structured thread context to a backend API, and returns a reviewed draft that the user can manually insert into the editor.

## Overview

This project is designed to improve reply quality beyond simple smart-reply suggestions. Instead of reacting only to the latest message, it analyzes the visible thread, classifies the conversation, selects a reply strategy, extracts structured context, generates a draft, and then performs a safety pass before showing the result inside Gmail.

## Features

- Gmail toolbar integration for:
  - inline replies
  - compose windows
  - forwarded emails
- Full visible thread extraction with speaker-aware formatting
- Background service worker for extension-to-backend communication
- Multi-agent orchestration pipeline
- Regeneration options:
  - `shorter`
  - `more_polite`
  - `more_friendly`
  - `more_professional`
- Safety review before presenting the final reply
- Manual insertion only
  - the extension never auto-sends emails

## Architecture

### Extension

The Chrome extension is responsible for:

- detecting active Gmail reply/compose editors
- injecting the `AI Reply` button into the Gmail toolbar
- extracting the visible email thread from the Gmail DOM
- sending requests to the backend through a Manifest V3 background service worker
- rendering an AI insights panel with:
  - intent
  - strategy
  - importance score
  - complexity level
  - urgency
  - key points
  - conversation summary
  - latest message intent

### Backend

The backend is an Express API that:

- accepts structured thread payloads from the extension
- runs a sequential multi-agent pipeline
- uses Gemini for reasoning and generation
- applies fallback logic if any individual agent fails
- returns a reviewed reply draft plus reasoning metadata

## Multi-Agent Pipeline

The orchestration pipeline runs in this order:

1. `classifierAgent`
   - identifies intent, tone, urgency, emotional tone, complexity, and importance
2. `strategyAgent`
   - decides how the assistant should respond
3. `contextAgent`
   - extracts summarized discussion insights from the thread
4. `responseGeneratorAgent`
   - writes the actual reply using classification, strategy, and context
5. `safetyAgent`
   - reviews the reply for professionalism and unsafe commitments

This sequence is implemented in [replyOrchestrator.js](d:/projects/Ai-Reply-Generator/backend/src/services/replyOrchestrator.js).

## Repository Structure

```text
Ai-Reply-Generator/
|-- extension/
|   |-- background.js
|   |-- content.js
|   `-- manifest.json
|-- backend/
|   |-- .env
|   |-- .env.example
|   |-- package.json
|   |-- scripts/
|   |   `-- testGeminiPipeline.js
|   `-- src/
|       |-- agents/
|       |   |-- baseAgent.js
|       |   |-- classifierAgent.js
|       |   |-- contextAgent.js
|       |   |-- responseGeneratorAgent.js
|       |   |-- safetyAgent.js
|       |   `-- strategyAgent.js
|       |-- config/
|       |   `-- env.js
|       |-- routes/
|       |   `-- replyRoutes.js
|       |-- services/
|       |   |-- geminiClient.js
|       |   |-- json.js
|       |   |-- openaiClient.js
|       |   `-- replyOrchestrator.js
|       |-- app.js
|       `-- server.js
`-- README.md
```

## Request Flow

1. The user opens Gmail and clicks `AI Reply`.
2. The content script extracts the visible thread and builds a structured conversation transcript.
3. The extension background service worker sends the payload to the backend:
   - `POST /api/reply/generate`
4. The backend runs the multi-agent pipeline.
5. A reviewed draft reply is returned to the extension.
6. The extension displays:
   - AI reasoning insights
   - conversation summary
   - draft reply
   - regenerate actions
7. The user chooses whether to insert the reply into Gmail.

## Thread Extraction Model

The extension does not rely only on the latest email block. It builds a thread transcript from the visible Gmail conversation and formats messages like this:

```text
FROM: Jean-Baptiste Onofré
MESSAGE:
Hi, with the release of Arrow Java 19.0.0...

---

FROM: David Li
MESSAGE:
It seems reasonable to me...
```

To keep prompts efficient, the extension currently:

- preserves message order
- keeps the newest message last
- limits very long threads to the last 5 visible messages
- caps total thread text length at roughly 6000 characters

## API

### Health Check

`GET /health`

Response:

```json
{
  "ok": true
}
```

### Generate Reply

`POST /api/reply/generate`

Example request body:

```json
{
  "emailThreadText": "FROM: Alice\nMESSAGE:\nCan you review this by Friday?\n\n---\n\nFROM: Bob\nMESSAGE:\nYes, I can take a look.",
  "senderName": "Alice",
  "senderEmail": "alice@example.com",
  "subject": "Review request",
  "threadId": "FMfcgzQgKvFlLNkJRsNwzwQZXlCqGrXz",
  "regenerateOption": "more_professional"
}
```

Example response body:

```json
{
  "success": true,
  "data": {
    "classification": {
      "intent": "express_interest",
      "tone": "professional",
      "emotionalTone": "positive",
      "apologyNeeded": false,
      "complexityLevel": "high",
      "importanceScore": 82,
      "urgency": "medium",
      "confidenceScore": 0.91,
      "reasoning": "..."
    },
    "strategy": {
      "strategyType": "express_interest",
      "recommendedTone": "professional",
      "actionRequired": true,
      "reasoning": "..."
    },
    "context": {
      "mainTopic": "5G Innovation Hackathon 2026",
      "keyPoints": [
        "hackathon opportunity",
        "team size 2 to 5",
        "proposal deadline April 17"
      ],
      "importantDates": [
        "April 17"
      ],
      "requestedAction": "submit internal form",
      "constraints": [
        "Keep the reply concise, relevant, and professional."
      ]
    },
    "draft": {
      "subjectSuggestion": "Re: 5G Innovation Hackathon 2026",
      "reply": "Hi,\n\nThank you for sharing the details...",
      "warnings": []
    }
  }
}
```

## Setup

### 1. Backend

```bash
cd backend
npm install
copy .env.example .env
```

Update `.env` with your own Gemini credentials:

```env
PORT=4000
FRONTEND_ORIGIN=*
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Start the backend:

```bash
npm run dev
```

### 2. Extension

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select the [extension](d:/projects/Ai-Reply-Generator/extension) folder
5. Open Gmail
6. Open a reply box or compose window
7. Click `AI Reply`

## Environment Variables

Defined in [env.js](d:/projects/Ai-Reply-Generator/backend/src/config/env.js):

- `PORT`
- `FRONTEND_ORIGIN`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

## Important Implementation Notes

### Gemini

The backend uses `@google/generative-ai` and initializes the model through [geminiClient.js](d:/projects/Ai-Reply-Generator/backend/src/services/geminiClient.js). When configured correctly, the server logs:

```text
Gemini API connected successfully
```

### CORS and Gmail

The backend is configured to allow requests from:

- `https://mail.google.com`
- local development origins
- Chrome extension origins

The extension uses [background.js](d:/projects/Ai-Reply-Generator/extension/background.js) to call the backend, which helps avoid Gmail loopback restrictions.

### Safety and Fallbacks

The pipeline is designed to continue even if an individual agent fails. Each agent has fallback behavior, and the orchestrator still returns a valid `classification`, `strategy`, `context`, and `draft.reply`.

## Current Strengths

- Good separation between Gmail UI logic and backend reasoning
- Clear agent modularity
- Thread-aware extraction
- Strategy-aware generation
- Safety review layer
- Regeneration support without changing the API contract

## Current Limitations

- Gmail DOM selectors may need maintenance if Gmail changes its markup
- The extension uses visible thread content only
  - collapsed or hidden messages are not analyzed
- There is no persistence, authentication, or database layer
- Rate limiting is in-memory and not suitable for multi-instance deployment
- Testing is mostly manual today

## Recommended Next Improvements

- Add automated tests for:
  - thread extraction
  - orchestrator fallbacks
  - API contract validation
- Add structured logging for each orchestration step
- Add prompt and response tracing in development mode
- Add configuration profiles for staging and production
- Improve Gmail sender detection for complex nested threads
- Add UI controls for choosing reply style before generation

## Professional Summary

This codebase is a solid prototype of a Gmail AI reply assistant with a thoughtful multi-agent backend. The most mature parts are the orchestration design, thread-aware extraction, and the Gmail-integrated review workflow. The project is already beyond a simple “generate text” extension and is structured well enough to evolve into a production-grade internal productivity tool with more testing, authentication, and deployment hardening.
# Ai-Reply-Generator
