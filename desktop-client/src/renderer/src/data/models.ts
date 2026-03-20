import { LLMModel } from '../types'
import { MODEL_IDS } from '../../../types/models'

export const availableModels: LLMModel[] = [
  // OpenAI
  {
    id: MODEL_IDS.CHAT_GPT_4_1,
    name: 'GPT-4.1',
    provider: 'OpenAI',
    description: 'Top-tier reasoning, creativity and larger context'
  },
  {
    id: MODEL_IDS.CHAT_GPT_4_1_MINI,
    name: 'GPT-4.1 Mini',
    provider: 'OpenAI',
    description: 'Smaller, faster, and cost-efficient variant of GPT-4.1'
  },
  {
    id: MODEL_IDS.CHAT_GPT_5_3,
    name: 'GPT-5.3',
    provider: 'OpenAI',
    description: "OpenAI's extremely capable model"
  },
  {
    id: MODEL_IDS.CHAT_GPT_5_MINI,
    name: 'GPT-5 Mini',
    provider: 'OpenAI',
    description: 'Fast and efficient GPT-5 variant'
  },
  {
    id: MODEL_IDS.CHAT_GPT_4o,
    name: 'GPT-4o',
    provider: 'OpenAI',
    description: 'Optimized for a wide range of tasks with competitive performance'
  },
  {
    id: MODEL_IDS.CHAT_GPT_o1,
    name: 'o1',
    provider: 'OpenAI',
    description: 'Highly efficient model for low-latency scenarios'
  },
  // Google
  {
    id: MODEL_IDS.GEMINI_2_5_FLASH_LITE,
    name: 'Gemini 2.5 Flash Lite',
    provider: 'Google',
    description: 'Ultra Fast'
  },
  {
    id: MODEL_IDS.GEMINI_2_5_FLASH,
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    description: 'Fast all around help'
  },
  {
    id: MODEL_IDS.GEMINI_2_5_PRO,
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    description: 'Reasoning, math & code'
  },
  {
    id: MODEL_IDS.GEMINI_3_FLASH,
    name: 'Gemini 3 Flash',
    provider: 'Google',
    description: 'Balanced model built for speed, scale, and frontier intelligence'
  },
  {
    id: MODEL_IDS.GEMINI_3_PRO,
    name: 'Gemini 3 Pro',
    provider: 'Google',
    description: "Google's MOST INTELLIGENT MODEL"
  }
]
