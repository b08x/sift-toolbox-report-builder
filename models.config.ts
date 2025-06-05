import { AIProvider, AIModelConfig } from './types';

export const AVAILABLE_PROVIDERS_MODELS: AIModelConfig[] = [
  {
    id: 'gemini-2.5-flash-preview-05-20',
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
    id: 'gemini-2.5-pro-preview-06-05',
    name: 'Gemini 2.5 Pro (Preview)',
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
    id: 'gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash-001',
    provider: AIProvider.GOOGLE_GEMINI,
    supportsGoogleSearch: true,
    supportsVision: false,
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
    id: 'gemini-2.0-flash-live-001',
    name: 'Gemini 2.0 Flash Live-001',
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
    id: 'gemini-2.0-flash-lite-001',
    name: 'Gemini 2.0 Flash Lite-001',
    provider: AIProvider.GOOGLE_GEMINI,
    supportsGoogleSearch: false,
    supportsVision: false,
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
    id: 'gemini-2.0-flash-thinking-exp-01-21',
    name: 'Gemini 2.0 Flash Thinking Exp 01-21',
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
    id: 'gemma-3-27b-it',
    name: 'Gemma 3 27B',
    provider: AIProvider.GOOGLE_GEMINI,
    supportsGoogleSearch: false,
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
    id: 'openai/gpt-4.1-mini', // OpenRouter specific ID format
    name: 'GPT-4.1 Mini (via OpenRouter)',
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
        max: 1047576,
        step: 50,
        defaultValue: 4096
      }
    ],
  },
  {
    id: 'openai/gpt-4o-mini', // OpenRouter specific ID format
    name: 'GPT-4o-mini (via OpenRouter)',
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
        max: 128000,
        step: 50,
        defaultValue: 4096
      }
    ],
  },  
  {
    id: 'microsoft/phi-4-reasoning-plus:free', // OpenRouter specific ID format
    name: 'Phi 4 Reasoning Plus (free) (via OpenRouter)',
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
        max: 32768,
        step: 50,
        defaultValue: 4096
      }
    ],
  },
  {
    id: 'microsoft/phi-3-medium-128k-instruct', // OpenRouter specific ID format
    name: 'Phi-3 Medium 128K Instruct (via OpenRouter)',
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
        max: 128000,
        step: 50,
        defaultValue: 4096
      }
    ],
  },
  {
    id: 'anthropic/claude-sonnet-4', // OpenRouter specific ID format
    name: 'Claude Sonnet 4 (via OpenRouter)',
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
        max: 200000,
        step: 50,
        defaultValue: 4096
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
  {
    id: 'deepseek/deepseek-chat-v3-0324', // Example of another OpenRouter model
    name: 'DeepSeek V3 0324 (via OpenRouter)',
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
        max: 163640, // Check actual model limits if necessary
        step: 50,
        defaultValue: 4096
      }
    ],
  },  
];
