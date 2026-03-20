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
  CHAT_GPT_o1: 'o1',
  CHAT_GPT_5_3: 'gpt-5.3-chat',
  CHAT_GPT_5_MINI: 'gpt-5-mini'
} as const

export const AVAILABLE_MODEL_IDS = [
  MODEL_IDS.GEMINI_2_5_FLASH,
  MODEL_IDS.GEMINI_2_5_PRO,
  MODEL_IDS.CHAT_GPT_4_1,
  MODEL_IDS.CHAT_GPT_4_1_MINI,
  MODEL_IDS.CHAT_GPT_5_3,
  MODEL_IDS.CHAT_GPT_5_MINI
] as const

export type ModelId = (typeof AVAILABLE_MODEL_IDS)[number]
