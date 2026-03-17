// Maps AI platform to its stream backend function name
export const AI_STREAM_FUNCTIONS = {
  claude:      'claudeStream',
  chatgpt:     'openaiStream',
  gemini:      'geminiStream',
  perplexity:  'perplexityStream',
  grok:        'grokStream',
};

// Detect if running in an iframe
export function isInIframe() {
  try {
    return window.self !== window.top;
  } catch (_) {
    return true;
  }
}

// App-level params injected by the base44 vite plugin
export const appParams = typeof window !== 'undefined'
  ? (window.__BASE44_APP_PARAMS__ || {})
  : {};

// Diagnostic: Log if app params are missing
if (typeof window !== 'undefined' && !window.__BASE44_APP_PARAMS__) {
  console.warn('[Base44 Init] window.__BASE44_APP_PARAMS__ is missing — app ID will be undefined. Check Vite plugin is active.');
}