const API_BASE_URL = "http://localhost:4000/api/reply";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "GENERATE_AI_REPLY") {
    return false;
  }

  (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(message.payload || {})
      });

      const contentType = response.headers.get("content-type") || "";
      const body = contentType.includes("application/json")
        ? await response.json()
        : { success: false, error: await response.text() };

      if (!response.ok) {
        sendResponse({
          success: false,
          error: body?.error || `Backend request failed with status ${response.status}.`
        });
        return;
      }

      sendResponse(body);
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message || "Failed to reach backend service."
      });
    }
  })();

  return true;
});
