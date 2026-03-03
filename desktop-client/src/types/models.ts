// Centralized model configuration to avoid duplication
// This file is shared between main and renderer processes

export const MODEL_IDS = {
  // Google
  GEMINI_2_5_FLASH: 'gemini-2.5-flash',
  GEMINI_2_5_PRO: 'gemini-2.5-pro',
  GEMINI_2_5_FLASH_LITE: 'gemini-2.5-flash-lite',
  GEMINI_3_FLASH: 'gemini-3-flash-preview',
  GEMINI_3_PRO: 'gemini-3-pro-preview',
  // OpenAI
  CHAT_GPT_4_1: 'gpt-4.1',
  CHAT_GPT_4_1_MINI: 'gpt-4.1-mini',
  CHAT_GPT_4o: 'gpt-4o',
  CHAT_GPT_o1: 'o1'
} as const

export const AVAILABLE_MODEL_IDS = [
  // Google
  MODEL_IDS.GEMINI_2_5_FLASH,
  MODEL_IDS.GEMINI_2_5_PRO,
  // MODEL_IDS.GEMINI_2_5_FLASH_LITE, // redundant: weaker than flash, 3-flash also available
  // MODEL_IDS.GEMINI_3_FLASH,         // preview: unstable for production
  // MODEL_IDS.GEMINI_3_PRO,           // deprecated by Google, shutting down March 9 2026
  // OpenAI
  MODEL_IDS.CHAT_GPT_4_1,
  MODEL_IDS.CHAT_GPT_4_1_MINI,
  // MODEL_IDS.CHAT_GPT_4o,            // redundant: superseded by gpt-4.1 (cheaper + newer)
  // MODEL_IDS.CHAT_GPT_o1             // reasoning model: needs multi-credit support before enabling
] as const

export type ModelId = (typeof AVAILABLE_MODEL_IDS)[number]
