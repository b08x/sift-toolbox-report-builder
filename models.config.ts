import { AIProvider, AIModelConfig } from './types';

export const AVAILABLE_PROVIDERS_MODELS: AIModelConfig[] = [
  {
    id: 'gemini-2.5-flash-preview-04-17',
    name: 'Gemini 2.5 Flash (Preview)',
    provider: AIProvider.GOOGLE_GEMINI,
    supportsGoogleSearch: true,
    supportsVision: true,
    parameters: [
      { 
        key: 'temperature', 
        label: 'Temperature', 
        type: 'slider', 
        min: 0, 
        max: 1, 
        step: 0.01, 
        defaultValue: 0.7,
        description: 'Controls randomness. Lower for more predictable, higher for more creative.'
      },
      { 
        key: 'topP', 
        label: 'Top-P', 
        type: 'slider', 
        min: 0, 
        max: 1, 
        step: 0.01, 
        defaultValue: 0.95,
        description: 'Nucleus sampling. Considers tokens with probability mass adding up to topP.'
      },
      { 
        key: 'topK', 
        label: 'Top-K', 
        type: 'slider', 
        min: 1, 
        max: 100, 
        step: 1, 
        defaultValue: 40,
        description: 'Considers the top K most probable tokens.'
      },
    ],
  },
  {
    id: 'learnlm-2.0-flash-experimental',
    name: 'LearnLM 2.0 Flash (Experimental)',
    provider: AIProvider.GOOGLE_GEMINI,
    supportsGoogleSearch: false, 
    supportsVision: true, 
    parameters: [
      { key: 'temperature', label: 'Temperature', type: 'slider', min: 0, max: 2, step: 0.1, defaultValue: 0.8 },
    ],
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o (via OpenAI)',
    provider: AIProvider.OPENAI,
    supportsGoogleSearch: false,
    supportsVision: true,
    parameters: [
      { 
        key: 'temperature', 
        label: 'Temperature', 
        type: 'slider', 
        min: 0, 
        max: 2, 
        step: 0.01, 
        defaultValue: 0.7,
        description: 'Controls randomness. Higher values like 0.8 will make the output more random.'
      },
      { 
        key: 'topP', 
        label: 'Top-P', 
        type: 'slider', 
        min: 0, 
        max: 1, 
        step: 0.01, 
        defaultValue: 1,
        description: 'Nucleus sampling. Model considers results of tokens with top_p probability mass.'
      },
      {
        key: 'max_tokens',
        label: 'Max Tokens',
        type: 'slider', 
        min: 50,
        max: 4000, 
        step: 50,
        defaultValue: 1024,
        description: 'Maximum number of tokens to generate in the completion.'
      }
    ],
  },
  {
    id: 'openai/gpt-4o', // OpenRouter specific ID format
    name: 'GPT-4o (via OpenRouter)',
    provider: AIProvider.OPENROUTER,
    supportsGoogleSearch: false,
    supportsVision: true, // GPT-4o supports vision
    parameters: [
      { 
        key: 'temperature', 
        label: 'Temperature', 
        type: 'slider', 
        min: 0, 
        max: 2, 
        step: 0.01, 
        defaultValue: 0.7 
      },
      { 
        key: 'topP', 
        label: 'Top-P', 
        type: 'slider', 
        min: 0, 
        max: 1, 
        step: 0.01, 
        defaultValue: 1 
      },
      {
        key: 'max_tokens',
        label: 'Max Tokens',
        type: 'slider',
        min: 50,
        max: 4000,
        step: 50,
        defaultValue: 1024
      }
    ],
  },
  {
    id: 'google/gemma-3-27b-it', // Example of another OpenRouter model
    name: 'Gemma 3 27B (via OpenRouter)',
    provider: AIProvider.OPENROUTER,
    supportsGoogleSearch: false,
    supportsVision: false, // This model likely does not support vision
    parameters: [
      { 
        key: 'temperature', 
        label: 'Temperature', 
        type: 'slider', 
        min: 0, 
        max: 1, // Mistral models often have a max temp of 1
        step: 0.01, 
        defaultValue: 0.7 
      },
      { 
        key: 'topP', 
        label: 'Top-P', 
        type: 'slider', 
        min: 0, 
        max: 1, 
        step: 0.01, 
        defaultValue: 1 
      },
      {
        key: 'max_tokens',
        label: 'Max Tokens',
        type: 'slider',
        min: 50,
        max: 131072, // Check actual model limits if necessary
        step: 50,
        defaultValue: 4096
      }
    ],
  },
];