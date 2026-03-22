export function safeJsonParse(text, fallbackValue = {}) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return fallbackValue;
  }
}
