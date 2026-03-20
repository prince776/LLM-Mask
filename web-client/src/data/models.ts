import { LLMModel } from '../types'
import { MODEL_IDS } from '../types/models'

export const availableModels: LLMModel[] = [
  { id: MODEL_IDS.GEMINI_2_5_FLASH, name: 'Gemini 2.5 Flash', provider: 'Google', description: 'Fast all around help' },
  { id: MODEL_IDS.GEMINI_2_5_PRO, name: 'Gemini 2.5 Pro', provider: 'Google', description: 'Reasoning, math & code' },
  { id: MODEL_IDS.CHAT_GPT_4_1, name: 'GPT-4.1', provider: 'OpenAI', description: 'Top-tier reasoning and creativity' },
  { id: MODEL_IDS.CHAT_GPT_4_1_MINI, name: 'GPT-4.1 Mini', provider: 'OpenAI', description: 'Smaller, faster, cost-efficient' },
  { id: MODEL_IDS.CHAT_GPT_5_3, name: 'GPT-5.3', provider: 'OpenAI', description: "OpenAI's extremely capable model" },
  { id: MODEL_IDS.CHAT_GPT_5_MINI, name: 'GPT-5 Mini', provider: 'OpenAI', description: 'Fast and efficient GPT-5 variant' }
]
