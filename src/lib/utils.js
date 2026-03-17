import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = (() => {
  try { return window.self !== window.top; }
  catch { return true; }
})();