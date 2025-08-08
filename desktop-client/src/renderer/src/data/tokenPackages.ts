import { TokenPackage } from '../types';

export const tokenPackages: TokenPackage[] = [
  // GPT Models
  {
    id: 'gpt-4-turbo-starter',
    modelId: 'gpt-4-turbo',
    modelName: 'GPT-4 Turbo',
    tokens: 1000,
    price: 10
  },
  {
    id: 'gpt-4-turbo-pro',
    modelId: 'gpt-4-turbo',
    modelName: 'GPT-4 Turbo',
    tokens: 2500,
    price: 20,
    popular: true
  },
  {
    id: 'gpt-4-turbo-enterprise',
    modelId: 'gpt-4-turbo',
    modelName: 'GPT-4 Turbo',
    tokens: 5000,
    price: 35
  },
  
  // GPT-3.5 Models
  {
    id: 'gpt-3.5-turbo-starter',
    modelId: 'gpt-3.5-turbo',
    modelName: 'GPT-3.5 Turbo',
    tokens: 2000,
    price: 5
  },
  {
    id: 'gpt-3.5-turbo-pro',
    modelId: 'gpt-3.5-turbo',
    modelName: 'GPT-3.5 Turbo',
    tokens: 5000,
    price: 10,
    popular: true
  },
  {
    id: 'gpt-3.5-turbo-enterprise',
    modelId: 'gpt-3.5-turbo',
    modelName: 'GPT-3.5 Turbo',
    tokens: 10000,
    price: 18
  },

  // Claude Models
  {
    id: 'claude-3-opus-starter',
    modelId: 'claude-3-opus',
    modelName: 'Claude 3 Opus',
    tokens: 800,
    price: 12
  },
  {
    id: 'claude-3-opus-pro',
    modelId: 'claude-3-opus',
    modelName: 'Claude 3 Opus',
    tokens: 2000,
    price: 25,
    popular: true
  },
  {
    id: 'claude-3-opus-enterprise',
    modelId: 'claude-3-opus',
    modelName: 'Claude 3 Opus',
    tokens: 4000,
    price: 45
  },

  // Claude Sonnet
  {
    id: 'claude-3-sonnet-starter',
    modelId: 'claude-3-sonnet',
    modelName: 'Claude 3 Sonnet',
    tokens: 1500,
    price: 8
  },
  {
    id: 'claude-3-sonnet-pro',
    modelId: 'claude-3-sonnet',
    modelName: 'Claude 3 Sonnet',
    tokens: 3500,
    price: 15,
    popular: true
  },
  {
    id: 'claude-3-sonnet-enterprise',
    modelId: 'claude-3-sonnet',
    modelName: 'Claude 3 Sonnet',
    tokens: 7000,
    price: 28
  },

  // Gemini Models
  {
    id: 'gemini-pro-starter',
    modelId: 'gemini-pro',
    modelName: 'Gemini Pro',
    tokens: 2000,
    price: 5
  },
  {
    id: 'gemini-pro-pro',
    modelId: 'gemini-pro',
    modelName: 'Gemini Pro',
    tokens: 5000,
    price: 11,
    popular: true
  },
  {
    id: 'gemini-pro-enterprise',
    modelId: 'gemini-pro',
    modelName: 'Gemini Pro',
    tokens: 10000,
    price: 20
  },

  // Llama Models
  {
    id: 'llama-2-70b-starter',
    modelId: 'llama-2-70b',
    modelName: 'Llama 2 70B',
    tokens: 3000,
    price: 4
  },
  {
    id: 'llama-2-70b-pro',
    modelId: 'llama-2-70b',
    modelName: 'Llama 2 70B',
    tokens: 7500,
    price: 8,
    popular: true
  },
  {
    id: 'llama-2-70b-enterprise',
    modelId: 'llama-2-70b',
    modelName: 'Llama 2 70B',
    tokens: 15000,
    price: 15
  }
];