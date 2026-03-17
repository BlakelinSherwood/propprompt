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

// App configuration
export const appParams = {
  appId: '69b849e8d5f86924955e7fae',
};