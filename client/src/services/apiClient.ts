import { ReportType, AIModelConfig } from '../types';
import { API_BASE_URL } from '../constants';

export interface InitiateSiftAnalysisParams {
  userInputText?: string;
  userImageFile?: File;
  reportType: ReportType;
  selectedModelId: string;
  modelConfigParams: Record<string, any>;
}

export interface InitiateSiftAnalysisResponse {
  streamUrl: string;
}

export interface ModelConfigResponse {
  models: AIModelConfig[];
}

export const initiateSiftAnalysis = async (
  params: InitiateSiftAnalysisParams
): Promise<string> => {
  const formData = new FormData();

  if (params.userInputText) {
    formData.append('userInputText', params.userInputText);
  }
  if (params.userImageFile) {
    formData.append('userImageFile', params.userImageFile);
  }
  formData.append('reportType', params.reportType);
  formData.append('selectedModelId', params.selectedModelId);
  formData.append('modelConfigParams', JSON.stringify(params.modelConfigParams));

  const response = await fetch(`${API_BASE_URL}/sift/initiate`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
  }

  try {
    const data: InitiateSiftAnalysisResponse = await response.json();
    if (data && data.streamUrl) {
      return data.streamUrl;
    } else {
      throw new Error('API response did not include a streamUrl.');
    }
  } catch (e) {
    // Handle cases where response.json() fails or data.streamUrl is not found
    if (e instanceof Error) {
      throw new Error(`Failed to parse API response or missing streamUrl: ${e.message}`);
    }
    throw new Error('Failed to parse API response or missing streamUrl due to an unknown error.');
  }
};

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SiftChatParams {
  newUserMessageText: string;
  chatHistory: ChatMessage[];
  selectedModelId: string;
  modelConfigParams: Record<string, any>;
  preprocessingOutputText?: string;
  systemInstructionOverride?: string;
}

export const continueSiftChat = async (
  params: SiftChatParams,
  onMessage: (content: string) => void,
  onError: (error: any) => void,
  onComplete: () => void
): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/sift/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Chat request failed with status ${response.status}: ${errorBody}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              if (jsonStr.trim()) {
                const data = JSON.parse(jsonStr);
                if (data.delta) {
                  onMessage(data.delta);
                }
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', line);
            }
          } else if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim();
            if (eventType === 'complete') {
              onComplete();
              break;
            } else if (eventType === 'error') {
              const nextLine = lines[lines.indexOf(line) + 1];
              if (nextLine && nextLine.startsWith('data: ')) {
                try {
                  const errorData = JSON.parse(nextLine.slice(6));
                  onError(errorData);
                } catch (e) {
                  onError({ type: 'ParseError', message: 'Failed to parse error data' });
                }
              }
              break;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (error instanceof Error) {
      onError({
        type: 'NetworkError',
        message: `Error during chat request: ${error.message}`
      });
    } else {
      onError({
        type: 'UnknownError',
        message: 'An unknown error occurred during chat request'
      });
    }
  }
};

export const fetchModelConfigurations = async (): Promise<AIModelConfig[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/models/config`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to fetch model configurations (${response.status}): ${errorBody}`);
    }

    const data: ModelConfigResponse = await response.json();
    
    if (!data || !Array.isArray(data.models)) {
      throw new Error('Invalid response format: expected models array');
    }

    return data.models;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error fetching model configurations: ${error.message}`);
    }
    throw new Error('Unknown error occurred while fetching model configurations');
  }
};
