console.log("AI EXTENSION TEST");

const API_BASE_URL = "https://generate-email-ie0i.onrender.com/api/reply";
const COMPOSE_DIALOG_SELECTOR = 'div[role="dialog"]';
const TOOLBAR_SELECTOR = 'div[role="toolbar"]';
const editorSelectors = [
  'div[role="textbox"][contenteditable="true"]',
  'div[aria-label="Message Body"]',
  'div[g_editable="true"]'
];
const THREAD_CONTAINER_SELECTOR = 'div[role="listitem"], div.adn';
const BUTTON_CLASS = "ai-reply-generator-btn";
const PANEL_CLASS = "ai-reply-generator-panel";

window.addEventListener("load", () => {
  injectStyles();
  startObserver();
});

function startObserver() {
  console.log("AI extension observer started");
  let scanScheduled = false;
  let pollingId = null;

  const injectButton = () => {
    scanScheduled = false;
    try {
      attachButtonsToOpenComposers();
    } catch (error) {
      console.error("AI Reply injection failed:", error);
    }
  };

  const scheduleScan = () => {
    if (scanScheduled) {
      return;
    }

    scanScheduled = true;
    window.setTimeout(injectButton, 120);
  };

  const observer = new MutationObserver(() => {
    scheduleScan();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  injectButton();
  pollingId = window.setInterval(() => {
    const hasPendingToolbar = Array.from(document.querySelectorAll(editorSelectors.join(", "))).some((editor) => {
      if (!(editor instanceof HTMLElement) || !isElementVisible(editor)) {
        return false;
      }

      const container = findReplyContainer(editor);
      const toolbar = container ? findComposeToolbar(container, editor) : null;
      return toolbar && !toolbar.querySelector(`.${BUTTON_CLASS}`);
    });

    if (hasPendingToolbar) {
      injectButton();
      return;
    }

    const hasInjectedButton = document.querySelector(`${TOOLBAR_SELECTOR} .${BUTTON_CLASS}`);
    if (hasInjectedButton && pollingId) {
      clearInterval(pollingId);
      pollingId = null;
    }
  }, 1500);
}

function attachButtonsToOpenComposers() {
  const editors = document.querySelectorAll(editorSelectors.join(", "));
  console.log("Editors detected:", editors.length);

  editors.forEach((editor) => {
    if (!(editor instanceof HTMLElement) || !isElementVisible(editor)) {
      return;
    }

    const composer = findReplyContainer(editor);
    const toolbar = composer ? findComposeToolbar(composer, editor) : null;

    if (!composer || !toolbar || composer.querySelector(`.${BUTTON_CLASS}`)) {
      return;
    }

    const button = createAiReplyButton(composer);
    const visibleControls = Array.from(toolbar.children).filter((child) =>
      child instanceof HTMLElement && isElementVisible(child)
    );

    if (visibleControls.length > 0) {
      toolbar.insertBefore(button, visibleControls[visibleControls.length - 1]);
    } else {
      toolbar.appendChild(button);
    }

    console.log("AI Reply button inserted");
  });
}

function createAiReplyButton(composer) {
  const aiBtn = document.createElement("button");
  aiBtn.type = "button";
  aiBtn.textContent = "AI Reply";
  aiBtn.className = BUTTON_CLASS;
  aiBtn.style.marginLeft = "8px";
  aiBtn.style.padding = "6px 12px";
  aiBtn.style.borderRadius = "16px";
  aiBtn.style.border = "none";
  aiBtn.style.background = "#1a73e8";
  aiBtn.style.color = "white";
  aiBtn.style.cursor = "pointer";
  aiBtn.addEventListener("click", () => handleGenerateClick(composer, aiBtn));
  return aiBtn;
}

function isLikelyGmailEditor(editor) {
  const ariaLabel = (editor.getAttribute("aria-label") || "").toLowerCase();
  const isEditable = editor.getAttribute("contenteditable") === "true";
  const isTextbox = editor.getAttribute("role") === "textbox";

  if (!isEditable && !isTextbox) {
    return false;
  }

  if (ariaLabel.includes("message")) {
    return true;
  }

  return Boolean(
    findReplyContainer(editor)
  );
}

function findReplyContainer(editor) {
  return (
    editor.closest('[role="dialog"]') ||
    editor.closest('[role="region"]') ||
    editor.closest("form") ||
    findAncestorWithBottomControls(editor) ||
    editor.parentElement
  );
}

function findAncestorWithBottomControls(editor) {
  if (!(editor instanceof HTMLElement)) {
    return null;
  }

  let current = editor.parentElement;

  while (current && current !== document.body) {
    const actionRow = findBottomActionRow(current, editor);
    if (actionRow) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

function findComposeToolbar(composer, editor) {
  if (!(composer instanceof HTMLElement) || !composer.isConnected) {
    return null;
  }

  const semanticToolbar = Array.from(composer.querySelectorAll('div[role="toolbar"]')).find((toolbar) =>
    isElementVisible(toolbar)
  );

  if (semanticToolbar) {
    return semanticToolbar;
  }

  if (!(editor instanceof HTMLElement) || !editor.isConnected) {
    return null;
  }

  return findBottomActionRow(composer, editor);
}

function findBottomActionRow(container, editor) {
  if (
    !(container instanceof HTMLElement) ||
    !container.isConnected ||
    !(editor instanceof HTMLElement) ||
    !editor.isConnected ||
    typeof editor.getBoundingClientRect !== "function"
  ) {
    return null;
  }

  try {
    const editorRect = editor.getBoundingClientRect();
    const candidates = Array.from(container.querySelectorAll("div, td")).filter((node) => {
      if (
        !(node instanceof HTMLElement) ||
        !node.isConnected ||
        !isElementVisible(node) ||
        typeof node.getBoundingClientRect !== "function"
      ) {
        return false;
      }

      const controls = Array.from(node.querySelectorAll('button, [role="button"]')).filter((control) =>
        isElementVisible(control)
      );

      if (controls.length < 4) {
        return false;
      }

      const rect = node.getBoundingClientRect();
      return rect.top >= editorRect.bottom - 40 && rect.height > 24;
    });

    if (candidates.length === 0) {
      return null;
    }

    return candidates.sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();

      if (Math.abs(leftRect.top - rightRect.top) > 6) {
        return leftRect.top - rightRect.top;
      }

      return rightRect.width - leftRect.width;
    })[0];
  } catch (error) {
    console.warn("AI Reply toolbar scan skipped until Gmail finishes rendering.", error);
    return null;
  }
}

function isElementVisible(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.offsetParent !== null;
}

async function handleGenerateClick(composer, button, regenerateOption = null) {
  const panel = getOrCreatePanel(composer);
  const defaultLabel = regenerateOption ? "Regenerate" : "Generate AI Reply";

  try {
    setLoadingState(panel, button, true, defaultLabel);
    button.disabled = true;

    const payload = extractEmailData(composer, regenerateOption);
    console.log("AI Reply request payload:", payload);

    const result = await sendGenerateRequest(payload);
    console.log("AI Reply response:", result);

    if (!result?.success) {
      throw new Error(result?.error || "Backend request failed.");
    }

    renderReply(panel, composer, result.data, button);
  } catch (error) {
    console.error("AI Reply request failed:", error);
    renderFeedback(panel, `Unable to generate reply. ${error.message}`, "error");
  } finally {
    setLoadingState(panel, button, false, defaultLabel);
  }
}

function sendGenerateRequest(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "GENERATE_AI_REPLY",
        payload
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(response);
      }
    );
  });
}

function extractEmailData(composer, regenerateOption) {
  const threadRoot = composer.closest(THREAD_CONTAINER_SELECTOR) || document;
  const threadText = getFullThreadText(threadRoot);
  const subject = getSubject();
  const sender = getSenderDetails(threadRoot);

  return {
    emailThreadText: threadText,
    emailText: threadText,
    senderName: sender.senderName,
    senderEmail: sender.senderEmail,
    subject,
    threadId: getThreadIdFromUrl(),
    regenerateOption
  };
}

function normalizeExtractedText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function isUsefulEmailText(text) {
  const normalized = normalizeExtractedText(text);
  return normalized.length > 30;
}

function cleanMessageNode(node) {
  if (!(node instanceof HTMLElement)) {
    return "";
  }

  const clone = node.cloneNode(true);
  if (!(clone instanceof HTMLElement)) {
    return "";
  }

  clone.querySelectorAll("blockquote, style, script, noscript").forEach((element) => element.remove());
  clone.querySelectorAll(`.${BUTTON_CLASS}, .${PANEL_CLASS}`).forEach((element) => element.remove());
  clone.querySelectorAll("button, [role='button'], input, textarea, select").forEach((element) => element.remove());

  return normalizeExtractedText(clone.innerText || clone.textContent || "");
}

function getMessageSenderName(container) {
  if (!(container instanceof HTMLElement)) {
    return "Unknown sender";
  }

  const senderNode =
    container.querySelector('[email]') ||
    container.querySelector('.gD, h3 [name], [data-hovercard-owner-id], [data-name]');

  return (
    senderNode?.getAttribute("name") ||
    senderNode?.getAttribute("data-name") ||
    normalizeExtractedText(senderNode?.textContent || "") ||
    "Unknown sender"
  );
}

function getThreadMessageEntries(root) {
  const threadContainers = Array.from(document.querySelectorAll('div.adn, [role="listitem"]'))
    .filter((node) => node instanceof HTMLElement && isElementVisible(node));

  const entries = threadContainers
    .map((container) => {
      const messageBlock = container.querySelector('div.a3s, div[dir="ltr"], div[role="article"]');
      if (!(messageBlock instanceof HTMLElement)) {
        return null;
      }

      const messageText = cleanMessageNode(messageBlock);
      if (!isUsefulEmailText(messageText)) {
        return null;
      }

      return {
        senderName: getMessageSenderName(container),
        messageText
      };
    })
    .filter(Boolean);

  if (entries.length) {
    return entries;
  }

  const fallbackBlocks = Array.from(root.querySelectorAll('div.a3s, div[dir="ltr"], div[role="article"]'))
    .filter((node) => node instanceof HTMLElement && isElementVisible(node))
    .map((node) => {
      const messageText = cleanMessageNode(node);
      if (!isUsefulEmailText(messageText)) {
        return null;
      }

      return {
        senderName: getMessageSenderName(node.closest('div.adn, [role="listitem"]') || root),
        messageText
      };
    })
    .filter(Boolean);

  return fallbackBlocks;
}

function getFullThreadText(root) {
  const entries = getThreadMessageEntries(root);
  const limitedEntries = entries.slice(-5);
  const parts = [];

  for (let index = 0; index < limitedEntries.length; index += 1) {
    const entry = limitedEntries[index];
    const section = `FROM: ${entry.senderName}\nMESSAGE:\n${entry.messageText}`;
    parts.push(section);
  }

  let combined = parts.join("\n\n---\n\n").trim();

  if (!combined) {
    const fallbackText = normalizeExtractedText(root.innerText || document.body.innerText || "Email content unavailable.");
    return (fallbackText || "Email content unavailable.").slice(0, 4000);
  }

  if (combined.length > 6000) {
    combined = combined.slice(combined.length - 6000);
  }

  return combined;
}

function getSenderDetails(root) {
  const scopedEmailNode =
    root.querySelector('[email]') ||
    document.querySelector('h3 [email], span[email], [data-hovercard-id*="@"]');
  const scopedNameNode =
    root.querySelector('.gD, h3 [name], [data-hovercard-owner-id]') ||
    document.querySelector('.gD, h3 [name], [data-hovercard-owner-id]');

  return {
    senderName:
      scopedNameNode?.getAttribute("name") ||
      scopedNameNode?.getAttribute("data-name") ||
      normalizeExtractedText(scopedNameNode?.textContent) ||
      "Unknown sender",
    senderEmail:
      scopedEmailNode?.getAttribute("email") ||
      scopedEmailNode?.getAttribute("data-hovercard-id") ||
      ""
  };
}

function getSubject() {
  const subjectNode =
    document.querySelector("h2.hP") ||
    document.querySelector('[role="main"] h2') ||
    document.querySelector('input[name="subjectbox"]');

  return normalizeExtractedText(subjectNode?.value || subjectNode?.textContent || "");
}

function getThreadIdFromUrl() {
  const hashMatch = window.location.hash.match(/[#/](?:inbox|all|sent|drafts|starred|important|label\/[^/]+)\/([^/?]+)/);
  if (hashMatch?.[1]) {
    return hashMatch[1];
  }

  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || window.location.hash || "";
}

function getOrCreatePanel(composer) {
  let panel = composer.querySelector(`.${PANEL_CLASS}`);

  if (panel) {
    return panel;
  }

  panel = document.createElement("div");
  panel.className = PANEL_CLASS;
  panel.innerHTML = `
    <div class="ai-reply-generator-status">Ready</div>
    <div class="ai-reply-generator-actions"></div>
  `;

  const editor = composer.querySelector(editorSelectors.join(", "));
  if (editor?.parentElement) {
    editor.parentElement.insertAdjacentElement("afterend", panel);
  } else {
    composer.appendChild(panel);
  }

  return panel;
}

function setPanelState(panel, message) {
  const status = panel.querySelector(".ai-reply-generator-status");
  if (status) {
    status.textContent = message;
  }
  const actions = panel.querySelector(".ai-reply-generator-actions");
  if (actions) {
    actions.innerHTML = "";
  }
}

function renderFeedback(panel, message, variant = "info") {
  const status = panel.querySelector(".ai-reply-generator-status");
  const actions = panel.querySelector(".ai-reply-generator-actions");

  if (status) {
    status.innerHTML = `
      <div class="ai-reply-feedback ai-reply-feedback-${escapeHtml(variant)}">
        ${escapeHtml(message)}
      </div>
    `;
  }

  if (actions) {
    actions.innerHTML = "";
  }
}

function setLoadingState(panel, button, isLoading, defaultLabel) {
  button.disabled = isLoading;
  button.textContent = isLoading ? "Generating..." : defaultLabel;

  if (isLoading) {
    renderFeedback(panel, "AI is generating reply...", "loading");
  }
}

function renderReply(panel, composer, data, button) {
  const status = panel.querySelector(".ai-reply-generator-status");
  const actions = panel.querySelector(".ai-reply-generator-actions");
  const warnings = Array.isArray(data.draft.warnings) ? data.draft.warnings : [];
  const confidenceScore = Number(data.classification?.confidenceScore);
  const keyPoints = Array.isArray(data.context?.keyPoints) ? data.context.keyPoints.filter(Boolean) : [];
  const lowConfidenceWarning =
    Number.isFinite(confidenceScore) && confidenceScore < 0.5
      ? `<div class="ai-reply-feedback ai-reply-feedback-warning">⚠️ AI is not fully confident. Please review carefully.</div>`
      : "";

  status.innerHTML = `
    <div class="ai-reply-insights">
      <div><strong>Conversation summary:</strong> ${escapeHtml(data.context?.mainTopic || data.subject || "Conversation thread")}</div>
      <div><strong>Latest message intent:</strong> ${escapeHtml(data.classification?.intent || "unknown")}</div>
      <div><strong>Intent:</strong> ${escapeHtml(data.classification?.intent || "unknown")}</div>
      <div><strong>Strategy:</strong> ${escapeHtml(data.strategy?.strategyType || "unknown")}</div>
      <div><strong>Importance:</strong> ${escapeHtml(String(data.classification?.importanceScore ?? "n/a"))}</div>
      <div><strong>Complexity:</strong> ${escapeHtml(data.classification?.complexityLevel || "unknown")}</div>
      <div><strong>Urgency:</strong> ${escapeHtml(data.classification?.urgency || "unknown")}</div>
      ${
        keyPoints.length
          ? `<div class="ai-reply-key-points"><strong>Key Points:</strong><ul>${keyPoints
              .slice(0, 5)
              .map((point) => `<li>${escapeHtml(point)}</li>`)
              .join("")}</ul></div>`
          : ""
      }
    </div>
    <div><strong>Suggested reply</strong></div>
    <pre>${escapeHtml(data.draft.reply)}</pre>
    <div class="ai-reply-meta">
      Tone: ${escapeHtml(data.classification.tone)} | Intent: ${escapeHtml(data.classification.intent)} | Urgency: ${escapeHtml(data.classification.urgency)}
    </div>
    ${lowConfidenceWarning}
    ${
      warnings.length
        ? `<div class="ai-reply-feedback ai-reply-feedback-warning">${escapeHtml(warnings.join(" "))}</div>`
        : `<div class="ai-reply-feedback ai-reply-feedback-success">Reply ready. Review it and insert it into your draft when you're happy with it.</div>`
    }
  `;

  const options = [
    { label: "Insert into draft", action: "insert" },
    { label: "Shorter", action: "shorter" },
    { label: "More polite", action: "more_polite" },
    { label: "More friendly", action: "more_friendly" },
    { label: "More professional", action: "more_professional" }
  ];

  actions.innerHTML = "";

  options.forEach((option) => {
    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.textContent = option.label;
    actionButton.addEventListener("click", () => {
      if (option.action === "insert") {
        insertReplyIntoEditor(composer, data.draft.reply);
        return;
      }

      handleGenerateClick(composer, button, option.action);
    });
    actions.appendChild(actionButton);
  });
}

function insertReplyIntoEditor(composer, replyText) {
  const editor = composer.querySelector(editorSelectors.join(", "));
  if (!editor) {
    return;
  }

  editor.focus();
  editor.innerHTML = replyText
    .split("\n")
    .map((line) => `<div>${escapeHtml(line) || "<br>"}</div>`)
    .join("");

  editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

function injectStyles() {
  if (document.getElementById("ai-reply-generator-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "ai-reply-generator-styles";
  style.textContent = `
    .${BUTTON_CLASS} {
      align-items: center;
      background: #1a73e8;
      border: none;
      border-radius: 16px;
      color: #fff;
      cursor: pointer;
      display: inline-flex;
      font-size: 12px;
      margin-left: 8px;
      padding: 6px 12px;
      vertical-align: middle;
    }

    .${BUTTON_CLASS}:disabled {
      cursor: wait;
      opacity: 0.7;
    }

    .${PANEL_CLASS} {
      background: #f7fbff;
      border: 1px solid #c9def5;
      border-radius: 12px;
      margin-top: 12px;
      padding: 12px;
    }

    .ai-reply-generator-status pre {
      background: #fff;
      border: 1px solid #e1e6eb;
      border-radius: 8px;
      margin: 8px 0;
      padding: 10px;
      white-space: pre-wrap;
    }

    .ai-reply-generator-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .ai-reply-generator-actions button {
      background: #fff;
      border: 1px solid #b7c6d8;
      border-radius: 16px;
      cursor: pointer;
      padding: 6px 10px;
    }

    .ai-reply-meta {
      color: #44566c;
      font-size: 12px;
    }

    .ai-reply-insights {
      background: #fff;
      border: 1px solid #e1e6eb;
      border-radius: 8px;
      margin-bottom: 10px;
      padding: 10px;
    }

    .ai-reply-insights > div {
      margin-bottom: 4px;
    }

    .ai-reply-key-points ul {
      margin: 6px 0 0;
      padding-left: 18px;
    }

    .ai-reply-key-points li {
      margin-bottom: 4px;
    }

    .ai-reply-feedback {
      border-radius: 8px;
      font-size: 12px;
      margin-top: 8px;
      padding: 8px 10px;
    }

    .ai-reply-feedback-loading {
      background: #eef6ff;
      color: #0f4c81;
    }

    .ai-reply-feedback-error {
      background: #fff1f1;
      color: #9f1c1c;
    }

    .ai-reply-feedback-success {
      background: #edf8ef;
      color: #1f6a35;
    }

    .ai-reply-feedback-warning {
      background: #fff8e8;
      color: #8a5a00;
    }
  `;

  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
