
import { GoogleGenAI, Part, GenerateContentResponse, GenerateContentParameters, Content } from "@google/genai";
import { ReportType, GeminiServiceResponse, GroundingChunk } from '../types';
import { SIFT_FULL_CHECK_PROMPT, SIFT_CONTEXT_REPORT_PROMPT, SIFT_COMMUNITY_NOTE_PROMPT } from '../prompts';
import { GEMINI_MODEL_NAME } from '../constants';

export const generateSiftReport = async (
  userInputText: string,
  userImageData: string | null,
  userImageMimeType: string | null,
  reportType: ReportType
  // apiKey parameter removed, process.env.API_KEY will be used directly
): Promise<GeminiServiceResponse> => {
  const apiKeyFromEnv = process.env.API_KEY;

  if (!apiKeyFromEnv) {
    throw new Error("Gemini API Key is not found in environment variables. Please ensure the API_KEY environment variable is set and accessible.");
  }
  
  const ai = new GoogleGenAI({ apiKey: apiKeyFromEnv });

  const parts: Part[] = [];

  if (userImageData && userImageMimeType) {
    parts.push({
      inlineData: {
        mimeType: userImageMimeType,
        data: userImageData,
      },
    });
  }

  let SiftInstructions = '';
  switch (reportType) {
    case ReportType.FULL_CHECK:
      SiftInstructions = SIFT_FULL_CHECK_PROMPT;
      break;
    case ReportType.CONTEXT_REPORT:
      SiftInstructions = SIFT_CONTEXT_REPORT_PROMPT;
      break;
    case ReportType.COMMUNITY_NOTE:
      SiftInstructions = SIFT_COMMUNITY_NOTE_PROMPT;
      break;
    default:
      throw new Error('Invalid report type selected.');
  }
  
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  let fullPromptText = SiftInstructions;
  
  fullPromptText = fullPromptText.replace(/\[current date placeholder, will be provided in task\]/g, currentDate);
  
  fullPromptText += "\n\n--- TASK START ---\n";
  fullPromptText += `The current date is: ${currentDate}. Please use this date where [current date] is specified in the output format for the Full Check, or as context for other reports.\n`;

  if (userInputText) {
    fullPromptText += `The user has provided the following text/claim for analysis: "${userInputText}"\n`;
  }
  if (userImageData) {
    fullPromptText += `The user has also uploaded an image. Please analyze it according to the SIFT instructions (e.g., describe, transcribe text if any, verify provenance).\n`;
  }
  fullPromptText += "Based on all the SIFT instructions and the provided input, please generate the requested report.\n";
  fullPromptText += "--- TASK END ---";

  parts.push({ text: fullPromptText });
  
  const contents: Content[] = [{ role: "user", parts }]; // Changed Contents to Content[]

  try {
    const generationParams: GenerateContentParameters = {
      model: GEMINI_MODEL_NAME,
      contents: contents,
      config: {
        tools: [{ googleSearch: {} }], 
        temperature: 0.5, 
      },
    };
    
    const response: GenerateContentResponse = await ai.models.generateContent(generationParams);
    
    const reportText = response.text;
    const groundingChunks: GroundingChunk[] | undefined = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(chunk => ({
        web: chunk.web ? { uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri } : undefined
    }));

    if (!reportText) {
        throw new Error("Received an empty report from the API.");
    }

    return { reportText, groundingChunks };

  } catch (error: any) {
    console.error('Gemini API Error:', error);
    if (error.message && error.message.includes('API_KEY_INVALID')) {
        throw new Error('The provided Gemini API Key is invalid or has expired.');
    }
    if (error.message && error.message.toLowerCase().includes('quota')) {
        throw new Error('API quota exceeded. Please check your Gemini API plan and usage.');
    }
    if (error.message && error.message.includes("grounding")) {
      throw new Error(`Error related to Google Search grounding: ${error.message}. The SIFT process often relies on web search; ensure your API key has permissions if this is a consistent issue.`);
    }
    throw new Error(`Failed to generate report using Gemini API: ${error.message || 'Unknown error'}`);
  }
};
