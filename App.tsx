
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse, Part } from "@google/genai"; // Removed APIError
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

const App: React.FC = () => {
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
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const constructFullPrompt = (text: string, type: ReportType): string => {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    let basePrompt = '';
    switch (type) {
      case ReportType.FULL_CHECK:
        basePrompt = SIFT_FULL_CHECK_PROMPT;
        break;
      case ReportType.CONTEXT_REPORT:
        basePrompt = SIFT_CONTEXT_REPORT_PROMPT;
        break;
      case ReportType.COMMUNITY_NOTE:
        basePrompt = SIFT_COMMUNITY_NOTE_PROMPT;
        break;
      default:
        basePrompt = SIFT_FULL_CHECK_PROMPT;
    }
    return `${basePrompt.replace(/\[current date placeholder, will be provided in task\]|\[current date\]/gi, currentDate)}\n\nUser's initial query: "${text}"`;
  };

  const handleStartChat = async (isRestart: boolean = false, restartQuery?: OriginalQueryInfo) => {
    setError(null);
    setIsLoading(true);
    setGeminiPreprocessingOutputText(null); // Clear previous output
    
    const currentModelConfig = getSelectedModelConfig();
    if (!currentModelConfig) {
      setError("Selected model configuration is not available.");
      setIsLoading(false);
      return;
    }
  
    const queryToUse = isRestart && restartQuery ? restartQuery : {
      text: userInputText,
      imageMimeType: userImageFile?.type,
      imageBase64: userImageFile ? await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(userImageFile);
      }) : null,
      reportType: reportType,
      userImagePreviewUrl: userImageFile ? URL.createObjectURL(userImageFile) : undefined,
    };

    if (!queryToUse.text?.trim() && !queryToUse.imageBase64) {
      setError("Please provide text or an image to analyze.");
      setIsLoading(false);
      return;
    }

    const userMessageId = uuidv4();
    const userMessageText = queryToUse.text || (queryToUse.imageBase64 ? "Image for analysis:" : "Empty query (should not happen)");
    
    const userDisplayMessage: ChatMessage = {
      id: userMessageId,
      sender: 'user',
      text: userMessageText,
      timestamp: new Date(),
      imagePreviewUrl: queryToUse.userImagePreviewUrl,
      originalQuery: { // Store original query details with the user message
        text: queryToUse.text,
        imageMimeType: queryToUse.imageMimeType,
        imageBase64: queryToUse.imageBase64,
        reportType: queryToUse.reportType,
        userImagePreviewUrl: queryToUse.userImagePreviewUrl
      }
    };
    setChatMessages([userDisplayMessage]);
    setIsChatActive(true);
    setCurrentSiftQueryDetails({
      userInputText: queryToUse.text || '',
      userImagePreviewUrl: queryToUse.userImagePreviewUrl,
      reportType: queryToUse.reportType,
    });
    setOriginalQueryForRestart(queryToUse); // Save for potential restart

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    let currentProviderForMainExecution = selectedProviderKey;
    let mainExecutionModelId = selectedModelId;
    let mainExecutionPrompt = constructFullPrompt(queryToUse.text || (queryToUse.imageMimeType ? `Input is an image of type ${queryToUse.imageMimeType}. Please describe and analyze it based on the ${queryToUse.reportType} SIFT guidelines.` : ''), queryToUse.reportType);
    let mainExecutionImagePart: Part | null = null;
    if (queryToUse.imageBase64 && queryToUse.imageMimeType && currentModelConfig.supportsVision) {
        mainExecutionImagePart = { inlineData: { data: queryToUse.imageBase64, mimeType: queryToUse.imageMimeType } };
    }
    let openAIHistoryForMainExecution: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];


    // ---- Gemini Preprocessing Step (if enabled for OpenRouter) ----
    if (selectedProviderKey === AIProvider.OPENROUTER && enableGeminiPreprocessing) {
        if (!geminiAi) {
            setError("Google Gemini API Key is required for preprocessing but not available. Please ensure 'import.meta.env.VITE_API_KEY' is set.");
            setIsLoading(false);
            setChatMessages(prev => [...prev, {id: uuidv4(), sender: 'ai', text: "Error: Gemini API key (VITE_API_KEY) missing for preprocessing.", timestamp: new Date(), isError: true}]);
            return;
        }
        if (!openrouterApiKey && selectedProviderKey === AIProvider.OPENROUTER) {
             setError("OpenRouter API Key is required but not available. Please ensure 'import.meta.env.VITE_OPENROUTER_API_KEY' is set.");
             setIsLoading(false);
             setChatMessages(prev => [...prev, {id: uuidv4(), sender: 'ai', text: "Error: OpenRouter API key (VITE_OPENROUTER_API_KEY) missing.", timestamp: new Date(), isError: true}]);
             return;
        }


        const geminiPreprocessingModelId = 'gemini-2.5-flash-preview-04-17'; // Or make configurable
        const geminiAiMessageId = uuidv4();
        setChatMessages(prev => [...prev, { id: geminiAiMessageId, sender: 'ai', text: '', isLoading: true, timestamp: new Date(), modelId: geminiPreprocessingModelId, isInitialSIFTReport: true, originalQueryReportType: queryToUse.reportType }]);

        try {
            const geminiPromptParts: Part[] = [];
            const geminiSystemInstruction = getSystemPromptForSelectedModel(); // Use general SIFT prompt
            const geminiFullPromptForSift = constructFullPrompt(queryToUse.text || (queryToUse.imageMimeType ? `Input is an image of type ${queryToUse.imageMimeType}. Please describe and analyze it based on the ${queryToUse.reportType} SIFT guidelines.` : ''), queryToUse.reportType);
            geminiPromptParts.push({text: geminiFullPromptForSift});

            if (queryToUse.imageBase64 && queryToUse.imageMimeType) { // Assuming Gemini Flash supports vision
                geminiPromptParts.push({ inlineData: { data: queryToUse.imageBase64, mimeType: queryToUse.imageMimeType } });
            }
            
            const geminiConfig = {
                tools: [{ googleSearch: {} }], // Enable Google Search for Gemini step
                systemInstruction: geminiSystemInstruction, // Use system prompt
                temperature: 0.5, // Fixed reasonable temp for preprocessing
            };

            const stream = await geminiAi.models.generateContentStream({
                model: geminiPreprocessingModelId,
                contents: { role: "user", parts: geminiPromptParts },
                config: geminiConfig,
            });

            let accumulatedGeminiText = '';
            let currentGroundingChunks: GroundingChunk[] = [];

            for await (const chunk of stream) {
                if (signal.aborted) {
                  setChatMessages(prev => prev.map(m => m.id === geminiAiMessageId ? { ...m, text: accumulatedGeminiText + "\n\nGeneration stopped by user.", isLoading: false, isError: false, groundingSources: currentGroundingChunks } : m));
                  setIsLoading(false);
                  return;
                }
                const chunkText = chunk.text;
                accumulatedGeminiText += chunkText;
                if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
                    currentGroundingChunks = chunk.candidates[0].groundingMetadata.groundingChunks.map((gc: any) => ({ web: gc.web }));
                }
                setChatMessages(prev => prev.map(m => m.id === geminiAiMessageId ? { ...m, text: accumulatedGeminiText, isLoading: true, groundingSources: currentGroundingChunks } : m));
            }
            setGeminiPreprocessingOutputText(accumulatedGeminiText); // Save for next step
            setChatMessages(prev => prev.map(m => m.id === geminiAiMessageId ? { ...m, text: accumulatedGeminiText, isLoading: false, isError: false, groundingSources: currentGroundingChunks } : m));
            
            // Prepare for OpenRouter step
            currentProviderForMainExecution = AIProvider.OPENROUTER; // Already set, but for clarity
            mainExecutionModelId = selectedModelId; // Use the user-selected OpenRouter model
            mainExecutionPrompt = `The following is a SIFT analysis report generated by a previous AI (Gemini) based on the user's original query. Your task is to critically review, summarize, or provide additional insights on this report as a SIFT expert. \n\nUser's Original Query: "${queryToUse.text || 'Image was provided'}" (Report Type: ${queryToUse.reportType})\n\n---BEGIN GEMINI SIFT REPORT---\n${accumulatedGeminiText}\n---END GEMINI SIFT REPORT---\n\nPlease provide your analysis of the Gemini report:`;
            mainExecutionImagePart = null; // Image was processed by Gemini
            openAIHistoryForMainExecution = [
                { role: 'system', content: getSystemPromptForSelectedModel() }, // OpenRouter system prompt
                { role: 'user', content: mainExecutionPrompt }
            ];

        } catch (e) {
            console.error("Gemini preprocessing API call failed:", e);
            const errorText = `Gemini preprocessing failed: ${e instanceof Error ? e.message : String(e)}`;
            setChatMessages(prev => prev.map(m => m.id === geminiAiMessageId ? { ...m, text: errorText, isLoading: false, isError: true } : m));
            setError(errorText);
            setIsLoading(false);
            return;
        }
    }
    // ---- End Gemini Preprocessing Step ----


    // ---- Main Execution Step (Gemini, OpenAI, or OpenRouter after preprocessing) ----
    const aiMessageId = uuidv4();
    setChatMessages(prev => [...prev, { id: aiMessageId, sender: 'ai', text: '', isLoading: true, timestamp: new Date(), modelId: mainExecutionModelId, isInitialSIFTReport: !(selectedProviderKey === AIProvider.OPENROUTER && enableGeminiPreprocessing), originalQueryReportType: queryToUse.reportType }]);
    
    try {
      if (currentProviderForMainExecution === AIProvider.GOOGLE_GEMINI) {
        if (!geminiAi) {
          setError("Google Gemini API Key is not available or empty. Please ensure 'import.meta.env.VITE_API_KEY' is set.");
          setIsLoading(false);
          setChatMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: "Error: Gemini API key (VITE_API_KEY) missing.", isLoading: false, isError: true } : m));
          return;
        }
        
        const systemInstruction = getSystemPromptForSelectedModel();
        const geminiChat = geminiAi.chats.create({
          model: mainExecutionModelId,
          config: {
            ...modelConfigParams,
            tools: currentModelConfig?.supportsGoogleSearch ? [{ googleSearch: {} }] : undefined,
            systemInstruction: systemInstruction,
          },
          history: [], // Start fresh for initial SIFT report
        });
        setCurrentChat(geminiChat);
        
        const promptPartsForChat: Part[] = [{text: mainExecutionPrompt}];
        if (mainExecutionImagePart && currentModelConfig.supportsVision) {
            promptPartsForChat.push(mainExecutionImagePart);
        }

        const stream = await geminiChat.sendMessageStream({ message: promptPartsForChat });
        let accumulatedText = '';
        let currentGroundingChunks: GroundingChunk[] = [];

        for await (const chunk of stream) {
          if (signal.aborted) {
            setChatMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: accumulatedText + "\n\nGeneration stopped by user.", isLoading: false, isError: false, groundingSources: currentGroundingChunks } : m));
            setIsLoading(false);
            return;
          }
          const chunkText = chunk.text;
          accumulatedText += chunkText;
          if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            currentGroundingChunks = chunk.candidates[0].groundingMetadata.groundingChunks.map((gc: any) => ({ web: gc.web }));
          }
          setChatMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: accumulatedText, isLoading: true, groundingSources: currentGroundingChunks } : m));
        }
        setChatMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: accumulatedText, isLoading: false, isError: false, groundingSources: currentGroundingChunks } : m));

      } else if (currentProviderForMainExecution === AIProvider.OPENAI || currentProviderForMainExecution === AIProvider.OPENROUTER) {
        if (!openaiClient) {
          const keyName = currentProviderForMainExecution === AIProvider.OPENAI ? "OpenAI API Key (e.g. import.meta.env.VITE_OPENAI_API_KEY)" : "OpenRouter API Key (e.g. import.meta.env.VITE_OPENROUTER_API_KEY)";
          setError(`${keyName} is not available or empty. Please ensure it's set in your environment.`);
          setIsLoading(false);
          setChatMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: `Error: ${keyName} missing.`, isLoading: false, isError: true } : m));
          return;
        }
        
        let messagesToOpenAI: OpenAI.Chat.Completions.ChatCompletionMessageParam[];

        if (enableGeminiPreprocessing && currentProviderForMainExecution === AIProvider.OPENROUTER) {
            messagesToOpenAI = openAIHistoryForMainExecution; // Already prepared
        } else {
            messagesToOpenAI = [{ role: 'system', content: getSystemPromptForSelectedModel() }];
            const userOpenAIMessageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: 'text', text: mainExecutionPrompt }];
            if (mainExecutionImagePart && currentModelConfig.supportsVision && mainExecutionImagePart.inlineData) {
                userOpenAIMessageContent.push({
                type: 'image_url',
                image_url: { url: `data:${mainExecutionImagePart.inlineData.mimeType};base64,${mainExecutionImagePart.inlineData.data}` },
                });
            }
            messagesToOpenAI.push({ role: 'user', content: userOpenAIMessageContent });
        }
        
        setCurrentOpenAIChatHistory(messagesToOpenAI);

        const stream = await openaiClient.chat.completions.create({
          model: mainExecutionModelId,
          messages: messagesToOpenAI,
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
      console.error("API call failed:", e);
      const errorText = e instanceof OpenAI.APIError ? `OpenAI API Error: ${e.message} (Code: ${e.status})` : `Request failed: ${e instanceof Error ? e.message : String(e)}`;
      setChatMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: errorText, isLoading: false, isError: true } : m));
      setError(errorText);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
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
    setCurrentChat(null);
    setCurrentOpenAIChatHistory([]);
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
    setGeminiPreprocessingOutputText(null);
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
                if (checkAPIKeysAndSetError()) {
                  handleStartChat();
                }
              }}
              isLoading={isLoading}
              isChatActive={isChatActive}
              onStopGeneration={handleStopGeneration}
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
                onSendMessage={handleSendChatMessage}
                isLoading={isLoading}
                onStopGeneration={handleStopGeneration}
                onRestartGeneration={handleRestartGeneration}
                canRestart={originalQueryForRestart !== null && !isLoading}
              />
            </div>
          </div>
        )}

        <footer className="mt-auto pt-3 text-center text-xs text-slate-500 flex-shrink-0">
          <p>Powered by GenAI | SIFT Methodology. Ensure API keys are configured in your environment.</p>
           <p>
            {geminiApiKey ? "Gemini Key: Loaded" : <span className="text-red-400">Gemini Key: Not Loaded</span>} | 
            {openaiApiKey ? "OpenAI Key: Loaded" : <span className="text-red-400">OpenAI Key: Not Loaded</span>} |
            {openrouterApiKey ? "OpenRouter Key: Loaded" : <span className="text-red-400">OpenRouter Key: Not Loaded</span>}
          </p>
        </footer>
      </main>
    </div>
  );
};

export default App;
