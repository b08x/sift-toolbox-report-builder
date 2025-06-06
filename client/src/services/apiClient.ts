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
  analysisId?: string;
}

// Helper function to process individual SSE messages
// Returns true if the stream should complete (on completion or error events)
async function processSseMessage(
  message: string,
  onMessage: (content: string) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  onAnalysisId?: (analysisId: string) => void
): Promise<boolean> {
  const lines = message.split('\n');
  let eventType: string | null = null;
  let eventData: string | null = null;
  
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      eventData = line.slice(6);
    }
  }
  
  if (eventType === 'complete') {
    onComplete();
    return true; // Signal that the stream should complete
  } else if (eventType === 'error') {
    if (eventData) {
      try {
        const errorData = JSON.parse(eventData);
        onError(errorData);
      } catch (e) {
        onError({ type: 'ParseError', message: 'Failed to parse error data' });
      }
    } else {
      onError({ type: 'UnknownError', message: 'Received error event without data' });
    }
    return true; // Signal that the stream should complete on error
  } else if (eventType === 'analysis_id') {
    if (eventData && onAnalysisId) {
      try {
        const data = JSON.parse(eventData);
        if (data.analysis_id) {
          onAnalysisId(data.analysis_id);
        }
      } catch (e) {
        console.warn('Failed to parse analysis_id data:', eventData);
      }
    }
    return false; // Continue processing more messages
  } else if (eventData) {
    // This is a data message (either with or without explicit event type)
    try {
      const data = JSON.parse(eventData);
      if (data.delta) {
        onMessage(data.delta);
      }
    } catch (e) {
      console.warn('Failed to parse SSE data:', eventData);
    }
  }
  
  return false; // Continue processing more messages
}

export const continueSiftChat = async (
  params: SiftChatParams,
  onMessage: (content: string) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  signal?: AbortSignal,
  onAnalysisId?: (analysisId: string) => void
): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/sift/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
      signal,
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
    let buffer = '';
    
    try {
      while (true) {
        // Check for abort signal
        if (signal?.aborted) {
          throw new Error('Request was aborted');
        }
        
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages (messages end with \n\n)
        let messageEndIndex;
        while ((messageEndIndex = buffer.indexOf('\n\n')) !== -1) {
          const message = buffer.slice(0, messageEndIndex);
          buffer = buffer.slice(messageEndIndex + 2);
          
          if (message.trim()) {
            try {
              const shouldComplete = await processSseMessage(message, onMessage, onError, onComplete, onAnalysisId);
              if (shouldComplete) {
                return; // Exit the function immediately on completion or error
              }
            } catch (e) {
              console.warn('Failed to process SSE message:', e);
            }
          }
        }
      }
      
      // Process any remaining buffer content
      if (buffer.trim()) {
        try {
          const shouldComplete = await processSseMessage(buffer.trim(), onMessage, onError, onComplete, onAnalysisId);
          if (shouldComplete) {
            return; // Exit if completion or error was handled
          }
        } catch (e) {
          console.warn('Failed to process final SSE message:', e);
        }
      }
      
      // If we reach here without a completion event, call onComplete
      onComplete();
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

// Simplified wrapper for sending chat messages
export const sendChatMessage = async (
  messageText: string,
  chatHistory: ChatMessage[],
  selectedModelId: string,
  modelConfigParams: Record<string, any>,
  onMessage: (content: string) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  preprocessingOutputText?: string,
  systemInstructionOverride?: string,
  signal?: AbortSignal,
  analysisId?: string
): Promise<void> => {
  const params: SiftChatParams = {
    newUserMessageText: messageText,
    chatHistory,
    selectedModelId,
    modelConfigParams,
    preprocessingOutputText,
    systemInstructionOverride,
    analysisId,
  };

  return continueSiftChat(params, onMessage, onError, onComplete, signal);
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
