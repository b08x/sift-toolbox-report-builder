import { AIProvider, AIModelConfig } from './types';

export const AVAILABLE_PROVIDERS_MODELS: AIModelConfig[] = [
  {
    id: 'gemini-2.5-flash-preview-04-17',
    name: 'Gemini 2.5 Flash (Preview)',
    provider: AIProvider.GOOGLE_GEMINI,
    supportsGoogleSearch: true,
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
      // { key: 'maxOutputTokens', label: 'Max Output Tokens', type: 'number', min: 1, max: 8192, step: 1, defaultValue: 2048 } // Example
    ],
  },
  // Add more Gemini models here if desired
  // {
  //   id: 'another-gemini-model',
  //   name: 'Another Gemini Model',
  //   provider: AIProvider.GOOGLE_GEMINI,
  //   supportsGoogleSearch: false,
  //   parameters: [
  //     { key: 'temperature', label: 'Temperature', type: 'slider', min: 0, max: 2, step: 0.1, defaultValue: 0.8 },
  //   ],
  // }
];
