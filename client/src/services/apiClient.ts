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
