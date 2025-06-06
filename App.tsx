
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Chat, Part } from "@google/genai"; // Removed APIError, GenerateContentResponse
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Sidebar } from './components/Sidebar';
import { InputForm } from './components/InputForm';
import { ChatInterface } from './components/ChatInterface';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorAlert } from './components/ErrorAlert';
import { UserQueryPanel } from './components/UserQueryPanel';

import { 
  ReportType, 
  ChatMessage, 
  GroundingChunk, 
  OriginalQueryInfo, 
  AIProvider, 
  AIModelConfig, 
  ConfigurableParams,
  CurrentSiftQueryDetails
} from './types';
import { 
  SIFT_FULL_CHECK_PROMPT, 
  SIFT_CONTEXT_REPORT_PROMPT, 
  SIFT_COMMUNITY_NOTE_PROMPT,
  SIFT_CHAT_SYSTEM_PROMPT
} from './prompts';
import { AVAILABLE_PROVIDERS_MODELS } from './models.config';
import { initiateSiftAnalysis } from './services/apiClient';

// Helper function to update the last AI message that is currently loading
const updateLastLoadingAiMessage = (
  messages: ChatMessage[],
  updates: Partial<Omit<ChatMessage, 'id' | 'sender' | 'timestamp' | 'originalQuery' | 'originalQueryReportType' | 'modelId' | 'imagePreviewUrl' | 'groundingSources' >>
  // Be specific about what fields can be updated by typical SSE events.
  // 'text', 'isLoading', 'isError' are common.
): ChatMessage[] => {
  let targetMessageIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender === 'ai' && messages[i].isLoading) {
      targetMessageIndex = i;
      break;
    }
  }

  if (targetMessageIndex !== -1) {
    const updatedMessage = {
      ...messages[targetMessageIndex],
      ...updates,
    };
    const newMessages = [...messages];
    newMessages[targetMessageIndex] = updatedMessage;
    return newMessages;
  } else {
    // It's possible that by the time an event (like 'complete' or 'error') arrives,
    // the message is no longer marked as 'isLoading' or has been removed.
    // Or, if multiple 'error'/'complete' events arrive rapidly.
    console.warn("updateLastLoadingAiMessage: No currently loading AI message found to update. This might be normal if the stream ended or errored already.");
    return messages;
  }
};

const App: React.FC = () => {
  const [currentStreamUrl, setCurrentStreamUrl] = useState<string | null>(null);
  const [userInputText, setUserInputText] = useState<string>('');
  const [userImageFile, setUserImageFile] = useState<File | null>(null);
  const [reportType, setReportType] = useState<ReportType>(ReportType.FULL_CHECK);
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
  const [openaiApiKey, setOpenaiApiKey] = useState<string | null>(null);
  const [openrouterApiKey, setOpenrouterApiKey] = useState<string | null>(null);

  const [geminiAi, setGeminiAi] = useState<GoogleGenAI | null>(null);
  const [openaiClient, setOpenaiClient] = useState<OpenAI | null>(null);
  
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [currentOpenAIChatHistory, setCurrentOpenAIChatHistory] = useState<OpenAI.Chat.Completions.ChatCompletionMessageParam[]>([]);


  const [isChatActive, setIsChatActive] = useState<boolean>(false);
  const [currentSiftQueryDetails, setCurrentSiftQueryDetails] = useState<CurrentSiftQueryDetails | null>(null);
  const [originalQueryForRestart, setOriginalQueryForRestart] = useState<OriginalQueryInfo | null>(null);
  
  // Model Selection States
  const [selectedProviderKey, setSelectedProviderKey] = useState<AIProvider>(AIProvider.GOOGLE_GEMINI);
  const [selectedModelId, setSelectedModelId] = useState<string>(AVAILABLE_PROVIDERS_MODELS.find(m => m.provider === AIProvider.GOOGLE_GEMINI)?.id || AVAILABLE_PROVIDERS_MODELS[0].id);
  const [modelConfigParams, setModelConfigParams] = useState<ConfigurableParams>({});

  // Gemini Preprocessing state
  const [enableGeminiPreprocessing, setEnableGeminiPreprocessing] = useState<boolean>(false);
  const [geminiPreprocessingOutputText, setGeminiPreprocessingOutputText] = useState<string | null>(null);


  const chatContainerRef = useRef<HTMLDivElement>(null);
  // const abortControllerRef = useRef<AbortController | null>(null); // Will be removed or managed by SSE handler
  const abortControllerRef = useRef<AbortController | null>(null); // Keeping for handleStopGeneration, but not used in handleStartChat's core API call path

  // Initialize API keys and clients
  useEffect(() => {
    console.log('[DEBUG] Initializing API Keys from import.meta.env');
    console.log('[DEBUG] import.meta.env.VITE_API_KEY:', import.meta.env.VITE_API_KEY);
    console.log('[DEBUG] import.meta.env.VITE_OPENAI_API_KEY:', import.meta.env.VITE_OPENAI_API_KEY);
    console.log('[DEBUG] import.meta.env.VITE_OPENROUTER_API_KEY:', import.meta.env.VITE_OPENROUTER_API_KEY);

    const geminiKeyFromEnv = typeof import.meta.env.VITE_API_KEY === 'string' ? import.meta.env.VITE_API_KEY : null;
    setGeminiApiKey(geminiKeyFromEnv);
    console.log('[DEBUG] geminiApiKey (state after set from VITE_API_KEY):', geminiKeyFromEnv);

    const openaiKeyFromEnv = typeof import.meta.env.VITE_OPENAI_API_KEY === 'string' ? import.meta.env.VITE_OPENAI_API_KEY : null;
    setOpenaiApiKey(openaiKeyFromEnv);
    console.log('[DEBUG] openaiApiKey (state after set from VITE_OPENAI_API_KEY):', openaiKeyFromEnv);

    const openrouterKeyFromEnv = typeof import.meta.env.VITE_OPENROUTER_API_KEY === 'string' ? import.meta.env.VITE_OPENROUTER_API_KEY : null;
    setOpenrouterApiKey(openrouterKeyFromEnv);
    console.log('[DEBUG] openrouterApiKey (state after set from VITE_OPENROUTER_API_KEY):', openrouterKeyFromEnv);
  }, []);

  const getSelectedModelConfig = useCallback(() => {
    return AVAILABLE_PROVIDERS_MODELS.find(m => m.id === selectedModelId && m.provider === selectedProviderKey);
  }, [selectedModelId, selectedProviderKey]);

  useEffect(() => {
    const currentModelConfig = getSelectedModelConfig();
    if (currentModelConfig) {
      const initialParams: ConfigurableParams = {};
      currentModelConfig.parameters.forEach(param => {
        initialParams[param.key] = param.defaultValue;
      });
      setModelConfigParams(initialParams);
    }
  }, [selectedModelId, selectedProviderKey, getSelectedModelConfig]);


  useEffect(() => {
    setError(null); // Clear global error when provider changes
    const initClients = async () => {
      // Initialize Gemini
      if (selectedProviderKey === AIProvider.GOOGLE_GEMINI || (selectedProviderKey === AIProvider.OPENROUTER && enableGeminiPreprocessing)) {
        if (geminiApiKey) {
          try {
            const ga = new GoogleGenAI({ apiKey: geminiApiKey });
            setGeminiAi(ga);
          } catch (e) {
            console.error("Failed to initialize GoogleGenAI:", e);
            setError("Failed to initialize Google Gemini client. Check API key and network.");
            setGeminiAi(null);
          }
        } else {
          setGeminiAi(null);
          // Error set by API key check later if needed by an operation
        }
      } else {
        setGeminiAi(null);
      }

      // Initialize OpenAI client (for OpenAI or OpenRouter)
      if (selectedProviderKey === AIProvider.OPENAI) {
        if (openaiApiKey) {
          try {
            const oai = new OpenAI({ apiKey: openaiApiKey, dangerouslyAllowBrowser: true });
            setOpenaiClient(oai);
          } catch (e) {
            console.error("Failed to initialize OpenAI client:", e);
            setError("Failed to initialize OpenAI client. Check API key and network.");
            setOpenaiClient(null);
          }
        } else {
          setOpenaiClient(null);
        }
      } else if (selectedProviderKey === AIProvider.OPENROUTER) {
        if (openrouterApiKey) {
          try {
            const orai = new OpenAI({
              baseURL: 'https://openrouter.ai/api/v1',
              apiKey: openrouterApiKey,
              defaultHeaders: {
                'HTTP-Referer': 'https://sift-toolbox.app.placeholder.com', // Replace with actual site URL if deployed
                'X-Title': 'SIFT Toolbox Report Builder', // Replace with actual site name
              },
              dangerouslyAllowBrowser: true,
            });
            setOpenaiClient(orai);
          } catch (e) {
            console.error("Failed to initialize OpenRouter client:", e);
            setError("Failed to initialize OpenRouter client. Check API key and network.");
            setOpenaiClient(null);
          }
        } else {
          setOpenaiClient(null);
        }
      } else {
        setOpenaiClient(null);
      }
    };
    initClients();
  }, [selectedProviderKey, geminiApiKey, openaiApiKey, openrouterApiKey, enableGeminiPreprocessing]);


  const handleSelectProvider = (provider: AIProvider) => {
    setSelectedProviderKey(provider);
    const firstModel = AVAILABLE_PROVIDERS_MODELS.find(m => m.provider === provider);
    if (firstModel) {
      setSelectedModelId(firstModel.id);
    } else {
      setSelectedModelId(AVAILABLE_PROVIDERS_MODELS[0].id); // Fallback
    }
    handleClearChatAndReset(false); // Clear chat when provider changes
  };

  const handleSelectModel = (modelId: string) => {
    setSelectedModelId(modelId);
    // Potentially reset params or keep them if compatible
    const currentModelConfig = AVAILABLE_PROVIDERS_MODELS.find(m => m.id === modelId);
    if (currentModelConfig) {
      const newParams: ConfigurableParams = {};
      currentModelConfig.parameters.forEach(param => {
        newParams[param.key] = modelConfigParams[param.key] !== undefined ? modelConfigParams[param.key] : param.defaultValue;
      });
      setModelConfigParams(newParams);
    }
     handleClearChatAndReset(false);
  };

  const handleModelConfigChange = (key: string, value: number | string) => {
    setModelConfigParams(prev => ({ ...prev, [key]: value }));
  };
  
  const handleToggleGeminiPreprocessing = (enabled: boolean) => {
    setEnableGeminiPreprocessing(enabled);
    handleClearChatAndReset(false); // Clear chat when this mode changes
  };


  const getSystemPromptForSelectedModel = (): string => {
    const modelConfig = getSelectedModelConfig();
    let basePrompt = SIFT_CHAT_SYSTEM_PROMPT; // Default SIFT chat prompt

    if (modelConfig?.provider === AIProvider.OPENAI || modelConfig?.provider === AIProvider.OPENROUTER) {
        // OpenAI/OpenRouter might benefit from a slightly more direct system prompt for chat
        basePrompt = `You are a SIFT (Stop, Investigate, Find, Trace) methodology assistant. You help users fact-check claims, understand context, and analyze information. Follow instructions for specific report types when requested. Provide structured, well-cited responses. Ensure all tables are in Markdown format.`;
    }
    
    if (modelConfig?.defaultSystemPrompt) {
        basePrompt = modelConfig.defaultSystemPrompt;
    }
    return basePrompt;
  }


  const fileToGenerativePart = async (file: File): Promise<Part> => {
    const base64EncodedData = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: {
        mimeType: file.type,
        data: base64EncodedData,
      },
    };
  };

  // const fileToGenerativePart = async (file: File): Promise<Part> => {
  //   const base64EncodedData = await new Promise<string>((resolve) => {
  //     const reader = new FileReader();
  //     reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
  //     reader.readAsDataURL(file);
  //   });
  //   return {
  //     inlineData: {
  //       mimeType: file.type,
  //       data: base64EncodedData,
  //     },
  //   };
  // };

  // const constructFullPrompt = (text: string, type: ReportType): string => {
  //   const currentDate = new Date().toLocaleDateString('en-US', {
  //     year: 'numeric', month: 'long', day: 'numeric'
  //   });
  //   let basePrompt = '';
  //   switch (type) {
  //     case ReportType.FULL_CHECK:
  //       basePrompt = SIFT_FULL_CHECK_PROMPT;
  //       break;
  //     case ReportType.CONTEXT_REPORT:
  //       basePrompt = SIFT_CONTEXT_REPORT_PROMPT;
  //       break;
  //     case ReportType.COMMUNITY_NOTE:
  //       basePrompt = SIFT_COMMUNITY_NOTE_PROMPT;
  //       break;
  //     default:
  //       basePrompt = SIFT_FULL_CHECK_PROMPT;
  //   }
  //   return `${basePrompt.replace(/\[current date placeholder, will be provided in task\]|\[current date\]/gi, currentDate)}\n\nUser's initial query: "${text}"`;
  // };

  const handleStartChat = async (isRestart: boolean = false, restartQuery?: OriginalQueryInfo) => {
    setIsLoading(true);
    setError(null);
    // Clear previous pre-processing output if any, as a new SIFT analysis will start.
    setGeminiPreprocessingOutputText(null);

    // Determine the query details to use, prioritizing restartQuery if provided.
    const queryToUse = isRestart && restartQuery ? restartQuery : {
      text: userInputText,
      // For a new chat, image details are derived from userImageFile.
      // For a restart, they should be in restartQuery if an image was part of the original query.
      imageMimeType: userImageFile?.type,
      // imageBase64 is not directly prepared here for new chats; userImageFile is preferred.
      // If restarting, restartQuery.imageBase64 should be used if present.
      imageBase64: (isRestart && restartQuery?.imageBase64) ? restartQuery.imageBase64 : null,
      reportType: reportType,
      userImagePreviewUrl: userImageFile ? URL.createObjectURL(userImageFile) : (isRestart && restartQuery?.userImagePreviewUrl ? restartQuery.userImagePreviewUrl : undefined),
    };

    // Validate that there's content to analyze.
    if (!queryToUse.text?.trim() && !userImageFile && !queryToUse.imageBase64) {
      setError("Please provide text or an image to analyze.");
      setIsLoading(false);
      return;
    }

    // Create and set the user's message in the chat.
    const userMessageId = uuidv4();
    const userMessageText = queryToUse.text || (userImageFile || queryToUse.userImagePreviewUrl || queryToUse.imageBase64 ? "Image for analysis:" : "Empty query");
    
    const userDisplayMessage: ChatMessage = {
      id: userMessageId,
      sender: 'user',
      text: userMessageText,
      timestamp: new Date(),
      imagePreviewUrl: queryToUse.userImagePreviewUrl, // This might be undefined if restarting with only base64
      originalQuery: { // Store all relevant details of the query that initiated this SIFT analysis
        text: queryToUse.text,
        imageMimeType: queryToUse.imageMimeType,
        imageBase64: queryToUse.imageBase64, // Important for restarts if no File object is available
        reportType: queryToUse.reportType,
        userImagePreviewUrl: queryToUse.userImagePreviewUrl,
      }
    };
    setChatMessages([userDisplayMessage]); // Initialize chat with the user's message.

    // Update application state to reflect active chat and current query details.
    setIsChatActive(true);
    setCurrentSiftQueryDetails({
      userInputText: queryToUse.text || '',
      userImagePreviewUrl: queryToUse.userImagePreviewUrl, // May be undefined
      reportType: queryToUse.reportType,
    });

    // Save the complete query information for a potential restart.
    // This ensures that even if `userImageFile` is cleared, `imageBase64` is retained for restart if it was part of the query.
    setOriginalQueryForRestart({
        text: queryToUse.text,
        imageMimeType: queryToUse.imageMimeType,
        imageBase64: queryToUse.imageBase64,
        reportType: queryToUse.reportType,
        userImagePreviewUrl: queryToUse.userImagePreviewUrl,
    });

    // Add a placeholder message for the AI's response.
    const aiMessageId = uuidv4();
    setChatMessages(prev => [
      ...prev,
      {
        id: aiMessageId,
        sender: 'ai',
        text: '',
        isLoading: true,
        timestamp: new Date(),
        modelId: selectedModelId, // Reflects the model chosen for this SIFT analysis
        isInitialSIFTReport: true,
        originalQueryReportType: queryToUse.reportType
      }
    ]);

    try {
      // `userImageFile` is of type `File | null`. Pass it directly.
      // `initiateSiftAnalysis` expects `userImageFile?: File`.
      // If `isRestart` is true and `userImageFile` is null (e.g., after a page refresh),
      // but `queryToUse.imageBase64` exists, the current `initiateSiftAnalysis` signature
      // does not directly support passing base64. This refactor adheres to passing `userImageFile`.
      // The backend would need to handle `queryToUse.text` which might implicitly refer to an image,
      // or the `initiateSiftAnalysis` API and backend would need changes to accept base64.
      // For now, we pass the current `userImageFile` state (which could be null).

      const textToAnalyze = queryToUse.text || ''; // Ensure text is at least an empty string.
      const imageFileToPass = userImageFile; // This is `File | null`. API expects `File | undefined`. Null should be fine.

      const streamUrl = await initiateSiftAnalysis({
        userInputText: textToAnalyze,
        userImageFile: imageFileToPass || undefined,
        reportType: queryToUse.reportType,
        selectedModelId: selectedModelId,
        modelConfigParams: modelConfigParams
      });
      setCurrentStreamUrl(streamUrl); // Store the stream URL from the API response.
      setIsLoading(false); // Set loading to false; SSE handler will update the AI message.
      // The AI message placeholder (already added) will be updated by an SSE handler (to be implemented elsewhere).

    } catch (apiError: any) {
      console.error("initiateSiftAnalysis API call failed:", apiError);
      const errorText = apiError.message || "Failed to initiate SIFT analysis. Please try again.";
      setError(errorText);
      // Update the AI message placeholder to show the error.
      setChatMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: errorText, isLoading: false, isError: true } : m));
      setIsLoading(false);
    }
    // Removed old direct SDK calls, prompt construction, and related streaming logic.
    // abortControllerRef is no longer managed directly within this core path.
  };

  const handleSendChatMessage = async (messageText: string, command?: 'another round' | 'read the room') => {
    if (!isChatActive || isLoading) return;
    setError(null);
    setIsLoading(true);

    const userMessageId = uuidv4();
    const userMessage: ChatMessage = {
      id: userMessageId,
      sender: 'user',
      text: messageText,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, userMessage]);

    const aiMessageId = uuidv4();
    setChatMessages(prev => [...prev, { id: aiMessageId, sender: 'ai', text: '', isLoading: true, timestamp: new Date(), modelId: selectedModelId }]);
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const currentModelConfig = getSelectedModelConfig();
      if (!currentModelConfig) throw new Error("Model config not found for follow-up.");

      if (selectedProviderKey === AIProvider.GOOGLE_GEMINI) {
        if (!currentChat) {
          throw new Error("Chat session not initialized for Gemini.");
        }
        const stream = await currentChat.sendMessageStream({ message: messageText }); // Simple text message
        let accumulatedText = "";
        let currentGroundingChunks: GroundingChunk[] = [];
        for await (const chunk of stream) {
          if (signal.aborted) {
            setChatMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: accumulatedText + "\n\nGeneration stopped by user.", isLoading: false, groundingSources: currentGroundingChunks } : m));
            setIsLoading(false);
            return;
          }
          accumulatedText += chunk.text;
           if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            currentGroundingChunks = chunk.candidates[0].groundingMetadata.groundingChunks.map((gc: any) => ({ web: gc.web }));
          }
          setChatMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: accumulatedText, isLoading: true, groundingSources: currentGroundingChunks } : m));
        }
        setChatMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: accumulatedText, isLoading: false, groundingSources: currentGroundingChunks } : m));

      } else if (selectedProviderKey === AIProvider.OPENAI || selectedProviderKey === AIProvider.OPENROUTER) {
        if (!openaiClient) {
          throw new Error("OpenAI/OpenRouter client not initialized.");
        }
        
        let systemPromptContent = getSystemPromptForSelectedModel();
        // If the last AI message was OpenRouter after Gemini preprocessing, adjust system prompt for continuity
        const lastAiMessage = chatMessages.filter(m => m.sender === 'ai' && !m.isLoading).pop();

        if (lastAiMessage && geminiPreprocessingOutputText) {
            const lastAiModelConfig = AVAILABLE_PROVIDERS_MODELS.find(m => m.id === lastAiMessage.modelId);
            if (lastAiModelConfig?.provider === AIProvider.OPENROUTER && enableGeminiPreprocessing) {
                 systemPromptContent = `You are continuing a SIFT analysis. A previous AI (Gemini) provided an initial report (which you analyzed). The user is now following up on your analysis of that Gemini report. The Gemini report was: "${geminiPreprocessingOutputText.substring(0,500)}..."`;
            }
        }

        const updatedHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPromptContent },
            ...currentOpenAIChatHistory.filter(m => m.role !== 'system'), // Remove old system prompt
            { role: 'user', content: messageText }
        ];
        
        setCurrentOpenAIChatHistory(updatedHistory);

        const stream = await openaiClient.chat.completions.create({
          model: selectedModelId,
          messages: updatedHistory,
          stream: true,
          temperature: modelConfigParams.temperature as number ?? undefined,
          top_p: modelConfigParams.topP as number ?? undefined,
          max_tokens: modelConfigParams.max_tokens as number ?? undefined,
        });
        let accumulatedText = "";
        for await (const chunk of stream) {
          if (signal.aborted) {
            setChatMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: accumulatedText + "\n\nGeneration stopped by user.", isLoading: false } : m));
            setIsLoading(false);
            return;
          }
          accumulatedText += chunk.choices[0]?.delta?.content || "";
          setChatMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: accumulatedText, isLoading: true } : m));
        }
        setChatMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: accumulatedText, isLoading: false } : m));
        setCurrentOpenAIChatHistory(prev => [...prev, {role: 'assistant', content: accumulatedText}]);
      }
    } catch (e) {
       console.error("Follow-up API call failed:", e);
      const errorText = e instanceof OpenAI.APIError ? `OpenAI API Error: ${e.message} (Code: ${e.status})` : `Request failed: ${e instanceof Error ? e.message : String(e)}`;
      setChatMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: errorText, isLoading: false, isError: true } : m));
      setError(errorText);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };
  
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    // Update any message that was isLoading to show "stopped by user"
    setChatMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.isLoading ? { ...msg, text: msg.text + "\n\nGeneration stopped by user.", isLoading: false, isError: false } : msg
      )
    );
  };

  const handleRestartGeneration = () => {
    if (originalQueryForRestart) {
      // If Gemini preprocessing was used, we need to ensure the restart logic for OpenRouter
      // correctly uses the geminiPreprocessingOutputText.
      // The handleStartChat function has been updated to handle this if `geminiPreprocessingOutputText` is set
      // and the provider is OpenRouter with preprocessing enabled.
      // For simplicity, a "restart" will re-run the *final* AI's turn from the initial multi-step query.
      // If it was Gemini -> OpenRouter, it re-runs OpenRouter with Gemini's output.

      // We need to determine what was the last AI message in the initial SIFT report generation.
      // If it was a two-step (Gemini then OpenRouter), we want to restart the OpenRouter part.
      // The `originalQueryForRestart` holds the *user's* initial query.
      // `geminiPreprocessingOutputText` holds Gemini's output if that step ran.

      // Modify `originalQueryForRestart` if we are restarting OpenRouter part of a chain
      let queryForActualRestart = { ...originalQueryForRestart };
      if (selectedProviderKey === AIProvider.OPENROUTER && enableGeminiPreprocessing && geminiPreprocessingOutputText) {
        // Instruct OpenRouter to re-analyze the stored Gemini text.
        queryForActualRestart.text = `The following is a SIFT analysis report generated by a previous AI (Gemini) based on the user's original query. Your task is to critically review, summarize, or provide additional insights on this report as a SIFT expert. \n\nUser's Original Query: "${originalQueryForRestart.text || 'Image was provided'}" (Report Type: ${originalQueryForRestart.reportType})\n\n---BEGIN GEMINI SIFT REPORT---\n${geminiPreprocessingOutputText}\n---END GEMINI SIFT REPORT---\n\nPlease provide your analysis of the Gemini report (restart):`;
        queryForActualRestart.imageBase64 = null; // Image was handled by Gemini
        queryForActualRestart.imageMimeType = null;
        queryForActualRestart.userImagePreviewUrl = undefined;
      }

      // Clear current chat messages except for the original user query that initiated the SIFT report.
      const firstUserMessage = chatMessages.find(msg => msg.sender === 'user' && msg.originalQuery);
      if (firstUserMessage) {
        setChatMessages([firstUserMessage]); // Keep only the first user message that started it all
      } else {
         setChatMessages([]); // Fallback if something unexpected happened
      }
      setIsChatActive(true); // Ensure chat remains active
      setCurrentChat(null); // Reset Gemini chat session state
      setCurrentOpenAIChatHistory([]); // Reset OpenAI history
      handleStartChat(true, queryForActualRestart);
    }
  };

  const handleClearChatAndReset = (resetInputFields = true) => {
    setChatMessages([]);
    setCurrentChat(null); // Related to old Gemini direct client
    setCurrentOpenAIChatHistory([]); // Related to old OpenAI direct client
    setCurrentStreamUrl(null); // Reset the stream URL
    setIsChatActive(false);
    setIsLoading(false);
    setError(null);
    if (resetInputFields) {
        setUserInputText('');
        setUserImageFile(null);
        // reportType can remain as user's last selection
    }
    setOriginalQueryForRestart(null);
    setCurrentSiftQueryDetails(null);
    setGeminiPreprocessingOutputText(null); // Related to old preprocessing logic
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const selectedModelDetails = getSelectedModelConfig();
  const modelSupportsVision = selectedModelDetails?.supportsVision ?? false;

  const checkAPIKeysAndSetError = () => {
    console.log('[DEBUG] checkAPIKeysAndSetError called.');
    console.log('[DEBUG] selectedProviderKey:', selectedProviderKey);
    console.log('[DEBUG] enableGeminiPreprocessing:', enableGeminiPreprocessing);
    console.log('[DEBUG] state geminiApiKey:', geminiApiKey);
    console.log('[DEBUG] state openaiApiKey:', openaiApiKey);
    console.log('[DEBUG] state openrouterApiKey:', openrouterApiKey);
    let keyError = null;
    if (selectedProviderKey === AIProvider.GOOGLE_GEMINI && !geminiApiKey) {
      keyError = "Google Gemini API Key is not available. Please ensure 'import.meta.env.VITE_API_KEY' is set in your environment.";
    } else if (selectedProviderKey === AIProvider.OPENAI && !openaiApiKey) {
      keyError = "OpenAI API Key is not available. Please ensure 'import.meta.env.VITE_OPENAI_API_KEY' is set in your environment.";
    } else if (selectedProviderKey === AIProvider.OPENROUTER) {
      if (!openrouterApiKey) {
        keyError = "OpenRouter API Key is not available. Please ensure 'import.meta.env.VITE_OPENROUTER_API_KEY' is set in your environment.";
      }
      if (enableGeminiPreprocessing && !geminiApiKey) {
        const openRouterError = keyError ? `${keyError} Additionally, ` : "";
        keyError = `${openRouterError}Google Gemini API Key (import.meta.env.VITE_API_KEY) is required for preprocessing with OpenRouter but not available. Please ensure it's set.`;
      }
    }
    if (keyError) {
      console.log('[DEBUG] Setting error in checkAPIKeysAndSetError:', keyError);
    }
    setError(keyError);
    return !keyError; // Returns true if keys are okay for the current selection
  };

  // Effect to check API keys when provider or preprocessing mode changes
  useEffect(() => {
    checkAPIKeysAndSetError();
  }, [selectedProviderKey, geminiApiKey, openaiApiKey, openrouterApiKey, enableGeminiPreprocessing]);

  // Effect for handling Server-Sent Events (SSE)
  useEffect(() => {
    let eventSource: EventSource | null = null;

    if (currentStreamUrl && currentStreamUrl.trim() !== '') {
      console.log('SSE: Connecting to', currentStreamUrl);
      eventSource = new EventSource(currentStreamUrl);

      eventSource.onopen = () => {
        console.log('SSE: Connection established');
      };

      eventSource.onmessage = (event) => {
        console.log('SSE: Received message:', event.data);
        try {
          const parsedData = JSON.parse(event.data);

          setChatMessages(prevMsgs => {
            const currentLastLoadingMessage = prevMsgs.slice().reverse().find(m => m.sender === 'ai' && m.isLoading);
            if (!currentLastLoadingMessage) {
                 console.warn('SSE onmessage: No loading AI message found to update with data:', parsedData);
                 return prevMsgs;
            }

            let newText = currentLastLoadingMessage.text || '';
            if (parsedData.delta && typeof parsedData.delta === 'string') {
              newText += parsedData.delta;
            } else if (parsedData.text_chunk && typeof parsedData.text_chunk === 'string') {
              newText = parsedData.text_chunk; // Replace as per original instruction
            }
            return updateLastLoadingAiMessage(prevMsgs, { text: newText });
          });
        } catch (e) {
          console.error('SSE: Failed to parse message data or update chat:', e, event.data);
        }
      };

      eventSource.onerror = (errorEvent) => {
        console.error('SSE: Connection error:', errorEvent);

        setChatMessages(prevMsgs => updateLastLoadingAiMessage(prevMsgs, {
          text: "An error occurred while streaming the response. Please try again.",
          isLoading: false,
          isError: true,
        }));

        setError("SSE connection failed. Check the console for more details.");
        if (eventSource) {
          eventSource.close();
        }
        setCurrentStreamUrl(null); // Prevent reconnection attempts
      };

      eventSource.addEventListener('error', (event) => {
        // This is for custom 'error' type events from the backend, distinct from eventSource.onerror
        console.error('SSE: Received custom backend error event:', event);

        let backendErrorMessage = "An error occurred on the backend.";
        // Standard EventSource events don't have a 'data' field directly on the event object for 'error' type listeners.
        // However, if the server sends a custom event *named* 'error' with data, it will be a MessageEvent.
        if (event instanceof MessageEvent && event.data) {
          try {
            const parsedData = JSON.parse(event.data);
            backendErrorMessage = parsedData.message || parsedData.error || backendErrorMessage;
          } catch (e) {
            console.error('SSE: Failed to parse custom backend error event data:', e, event.data);
            // Use the default backendErrorMessage if parsing fails
          }
        } else {
          // If it's not a MessageEvent or has no data, it might be a generic error event
          // that somehow got routed here. We'll use a generic message.
          console.warn('SSE: Custom backend error event did not contain parsable data. Event:', event);
        }

        setChatMessages(prevMsgs => updateLastLoadingAiMessage(prevMsgs, {
          text: backendErrorMessage,
          isLoading: false,
          isError: true,
        }));

        setError(backendErrorMessage); // Set global error state
        setIsLoading(false); // Set global loading to false

        if (eventSource) {
          eventSource.close();
        }
        setCurrentStreamUrl(null);
      });

      eventSource.addEventListener('complete', (event) => {
        console.log('SSE: Received stream complete event:', event);
        // Optionally, parse event.data if the backend sends any final message or metadata with 'complete'.
        // For now, we assume 'complete' is just a signal to finalize.

        setChatMessages(prevMsgs => updateLastLoadingAiMessage(prevMsgs, { isLoading: false }));

        setIsLoading(false); // Set global loading to false

        if (eventSource) {
          eventSource.close();
        }
        setCurrentStreamUrl(null); // Clean up URL
      });
    }

    return () => {
      if (eventSource) {
        console.log('SSE: Closing connection');
        eventSource.close();
      }
    };
  }, [currentStreamUrl, setChatMessages, setError, setIsLoading, setCurrentStreamUrl, chatMessages]);

  return (
    <div className="flex flex-col md:flex-row h-screen max-h-screen bg-slate-900 text-slate-100">
      <Sidebar
        availableModels={AVAILABLE_PROVIDERS_MODELS}
        selectedProviderKey={selectedProviderKey}
        onSelectProvider={handleSelectProvider}
        selectedModelId={selectedModelId}
        onSelectModelId={handleSelectModel}
        modelConfigParams={modelConfigParams}
        onModelConfigParamChange={handleModelConfigChange}
        onClearChatAndReset={() => handleClearChatAndReset(true)}
        isChatActive={isChatActive}
        enableGeminiPreprocessing={enableGeminiPreprocessing}
        onToggleGeminiPreprocessing={handleToggleGeminiPreprocessing}
      />

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col p-3 md:p-6 overflow-hidden h-full">
        <header className="mb-4 flex-shrink-0">
          <h1 className="text-2xl md:text-3xl font-bold text-sky-400 flex items-center">
            <span className="mr-2 text-3xl md:text-4xl">🔍</span>
            SIFT Toolbox Report Builder
          </h1>
           <p className="text-sm text-slate-400">
            Provider: <span className="font-semibold text-indigo-400">{selectedProviderKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
            {/* The 'enableGeminiPreprocessing' might be removed or its meaning changed with the new backend */}
            {selectedProviderKey === AIProvider.OPENROUTER && enableGeminiPreprocessing && " (with Gemini Preprocessing)"}
            {selectedModelDetails && ` | Model: ${selectedModelDetails.name}`}
          </p>
        </header>

        {error && <ErrorAlert message={error} />}
        
        {!isChatActive ? (
          <div className="flex-grow overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800">
            <InputForm
              userInputText={userInputText}
              setUserInputText={setUserInputText}
              userImageFile={userImageFile}
              setUserImageFile={setUserImageFile}
              reportType={reportType}
              setReportType={setReportType}
              onStartChat={() => { 
                // This client-side key check can remain for immediate UI feedback,
                // but the backend will ultimately validate any necessary keys.
                if (checkAPIKeysAndSetError()) {
                  handleStartChat();
                }
              }}
              isLoading={isLoading}
              isChatActive={isChatActive}
              onStopGeneration={handleStopGeneration} // This will need to interact with the SSE stream
              selectedModelSupportsVision={modelSupportsVision}
            />
            {isLoading && <LoadingSpinner reportType={reportType} onTimeout={handleStopGeneration} />}
          </div>
        ) : (
          <div className="flex-grow flex min-h-0"> {/* Ensure chat interface can shrink */}
            {currentSiftQueryDetails && (
              <UserQueryPanel
                userInputText={currentSiftQueryDetails.userInputText}
                userImagePreviewUrl={currentSiftQueryDetails.userImagePreviewUrl}
                reportType={currentSiftQueryDetails.reportType}
              />
            )}
            <div className="flex-grow pl-0 md:pl-4 min-w-0"> {/* Ensure chat interface takes remaining space and can shrink */}
              <ChatInterface
                ref={chatContainerRef}
                messages={chatMessages}
                onSendMessage={handleSendChatMessage} // Follow-up messages will also use the new backend/SSE logic
                isLoading={isLoading} // Reflects loading state from initiateSiftAnalysis and SSE stream
                onStopGeneration={handleStopGeneration} // Should signal backend to stop SSE stream
                onRestartGeneration={handleRestartGeneration}
                canRestart={originalQueryForRestart !== null && !isLoading}
              />
            </div>
          </div>
        )}

        <footer className="mt-auto pt-3 text-center text-xs text-slate-500 flex-shrink-0">
          <p>SIFT Toolbox. API interactions are now primarily handled by a backend service.</p>
           <p>
            {/* Client-side key status might be less relevant or represent local availability for other potential direct calls */}
            {geminiApiKey ? "Gemini Key: Loaded (client)" : <span className="text-red-400">Gemini Key: Not Loaded (client)</span>} |
            {openaiApiKey ? "OpenAI Key: Loaded (client)" : <span className="text-red-400">OpenAI Key: Not Loaded (client)</span>} |
            {openrouterApiKey ? "OpenRouter Key: Loaded (client)" : <span className="text-red-400">OpenRouter Key: Not Loaded (client)</span>}
          </p>
        </footer>
      </main>
    </div>
  );
};

export default App;
