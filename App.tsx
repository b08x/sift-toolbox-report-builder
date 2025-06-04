import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat, Part, GenerateContentResponse, Content } from "@google/genai";
import { v4 as uuidv4 } from 'uuid';

import { InputForm } from './components/InputForm';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorAlert } from './components/ErrorAlert';
import { ChatInterface } from './components/ChatInterface';
import { Sidebar } from './components/Sidebar';
import { UserQueryPanel } from './components/UserQueryPanel'; 
import { ReportType, ChatMessage, GroundingChunk, AIProvider, AIModelConfig, ConfigurableParams, ModelParameter, CurrentSiftQueryDetails, OriginalQueryInfo } from './types';
import { SIFT_ICON } from './constants';
import { SIFT_CHAT_SYSTEM_PROMPT, SIFT_FULL_CHECK_PROMPT, SIFT_CONTEXT_REPORT_PROMPT, SIFT_COMMUNITY_NOTE_PROMPT } from './prompts';
import { AVAILABLE_PROVIDERS_MODELS } from './models.config';

const App: React.FC = () => {
  const [userInputText, setUserInputText] = useState<string>('');
  const [userImageFile, setUserImageFile] = useState<File | null>(null);
  const [reportType, setReportType] = useState<ReportType>(ReportType.FULL_CHECK);
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [ai, setAi] = useState<GoogleGenAI | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [configLoaded, setConfigLoaded] = useState<boolean>(false);

  const [selectedProviderKey, setSelectedProviderKey] = useState<AIProvider>(AIProvider.GOOGLE_GEMINI);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [modelConfigParams, setModelConfigParams] = useState<ConfigurableParams>({});

  const [currentSiftQueryDetails, setCurrentSiftQueryDetails] = useState<CurrentSiftQueryDetails | null>(null);

  interface LastGenerationInput {
    partsToResend: Part[];
    modelIdToUse: string;
    // For restarting an initial SIFT report
    chatConfigForInitial?: any;
    originalQueryForInitial?: OriginalQueryInfo; // To reconstruct user query message and SIFT details panel
    // For restarting a follow-up message in an existing session
    chatSessionForFollowup?: Chat | null;
    // Discriminator
    isInitialRestart: boolean;
  }
  const [lastGenerationInput, setLastGenerationInput] = useState<LastGenerationInput | null>(null);

  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  const isStoppingRef = useRef<boolean>(false);

  useEffect(() => {
    if (AVAILABLE_PROVIDERS_MODELS.length > 0) {
      const initialModel = AVAILABLE_PROVIDERS_MODELS.find(m => m.provider === AIProvider.GOOGLE_GEMINI) || AVAILABLE_PROVIDERS_MODELS[0];
      if (initialModel) {
        setSelectedProviderKey(initialModel.provider);
        setSelectedModelId(initialModel.id);
        const initialParams: ConfigurableParams = {};
        initialModel.parameters.forEach(param => {
          initialParams[param.key] = param.defaultValue;
        });
        setModelConfigParams(initialParams);
      }
    }
  }, []);

  // Handle runtime config loading timing
  useEffect(() => {
    // Check if runtime config is already available
    if (typeof window !== 'undefined' && (window as any).RUNTIME_CONFIG) {
      console.log('🚀 Runtime config already available');
      setConfigLoaded(true);
      return;
    }

    // Listen for runtime config loaded event
    const handleConfigLoaded = () => {
      console.log('📡 Runtime config loaded event received');
      setConfigLoaded(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('runtime-config-loaded', handleConfigLoaded);
    }

    // Fallback: wait a bit and then check again
    const fallbackTimer = setTimeout(() => {
      console.log('⏱️ Fallback timer: checking for runtime config');
      setConfigLoaded(true);
    }, 1000);

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('runtime-config-loaded', handleConfigLoaded);
      }
      clearTimeout(fallbackTimer);
    };
  }, []);

  // Main API key initialization effect
  useEffect(() => {
    // Don't proceed until we've given runtime config a chance to load
    if (!configLoaded) {
      console.log('⏳ Waiting for runtime configuration to load...');
      return;
    }

    // Get API key with priority: Runtime Config > Vite Env
    const getRuntimeApiKey = () => {
      if (typeof window !== 'undefined' && (window as any).RUNTIME_CONFIG?.VITE_GEMINI_API_KEY) {
        return (window as any).RUNTIME_CONFIG.VITE_GEMINI_API_KEY;
      }
      return null;
    };

    const getViteApiKey = () => {
      return import.meta.env.VITE_GEMINI_API_KEY || '';
    };

    // Try runtime config first (for Docker), then fallback to Vite env (for dev)
    let envApiKey = getRuntimeApiKey() || getViteApiKey();
    
    console.log('🔍 API Key Debug (Post-Config Load):');
    console.log('  Config loaded state:', configLoaded);
    console.log('  Runtime config exists:', !!(typeof window !== 'undefined' && (window as any).RUNTIME_CONFIG));
    console.log('  Runtime API key:', getRuntimeApiKey() ? `${getRuntimeApiKey()?.substring(0, 10)}...` : 'none');
    console.log('  Vite API key:', getViteApiKey() ? `${getViteApiKey()?.substring(0, 10)}...` : 'none');
    console.log('  Final API key selected:', envApiKey ? `${envApiKey.substring(0, 10)}...` : 'none');
    console.log('  Key is placeholder:', envApiKey === 'VITE_GEMINI_API_KEY_PLACEHOLDER');
    
    // Validate API key
    const isValidKey = envApiKey && 
                      envApiKey.trim() !== '' && 
                      envApiKey !== 'VITE_GEMINI_API_KEY_PLACEHOLDER' && 
                      envApiKey !== 'NOT_SET';

    if (isValidKey) {
      setApiKey(envApiKey);
      try {
        if (selectedProviderKey === AIProvider.GOOGLE_GEMINI) {
          const genAI = new GoogleGenAI({ apiKey: envApiKey });
          setAi(genAI);
          setError(null); // Clear any previous errors
          console.log('✅ Google Gemini API client initialized successfully');
        } else {
          setError("Selected provider is not yet supported for API client initialization.");
          setAi(null);
        }
      } catch (e: any) {
        setError(`Failed to initialize API for ${selectedProviderKey}: ${e.message}. Ensure API key is valid.`);
        console.error("❌ API Initialization Error:", e);
        setAi(null);
      }
    } else {
      // Determine specific error message
      let errorMessage = "API Key not available.";
      
      if (envApiKey === 'VITE_GEMINI_API_KEY_PLACEHOLDER') {
        errorMessage = "API Key placeholder was not replaced during Docker startup. Check that GEMINI_API_KEY environment variable is set when running the container.";
      } else if (envApiKey === 'NOT_SET') {
        errorMessage = "GEMINI_API_KEY environment variable was not provided to the Docker container.";
      } else if (!envApiKey || envApiKey.trim() === '') {
        errorMessage = "No API key found. In Docker, ensure GEMINI_API_KEY environment variable is provided. In development, set VITE_GEMINI_API_KEY in your .env file.";
      } else {
        errorMessage = "API key found but appears to be invalid.";
      }
      
      setError(errorMessage);
      setAi(null);
      console.error('❌ API Key Error:', errorMessage);
    }
  }, [selectedProviderKey, configLoaded]);

  const getSiftInstructionsForReportType = (type: ReportType): string => {
    switch (type) {
      case ReportType.CONTEXT_REPORT:
        return SIFT_CONTEXT_REPORT_PROMPT;
      case ReportType.COMMUNITY_NOTE:
        return SIFT_COMMUNITY_NOTE_PROMPT;
      case ReportType.FULL_CHECK:
      default:
        return SIFT_FULL_CHECK_PROMPT;
    }
  };

  const handleClearChatAndReset = useCallback(() => {
    isStoppingRef.current = true; // Stop any ongoing generation
    setChatMessages([]);
    setChatSession(null);
    setUserInputText('');
    setUserImageFile(null);
    setCurrentSiftQueryDetails(null);
    setLastGenerationInput(null);
    setError(null);
    setIsLoading(false);
    // Ensure isStoppingRef is reset if a new operation starts later
    setTimeout(() => isStoppingRef.current = false, 0);
  }, []);

  const handleStopGeneration = useCallback(() => {
    isStoppingRef.current = true;
    setIsLoading(false);
    setError(null); // Clear any errors when stopping
    setChatMessages(prev => {
      if (prev.length === 0) return prev;
      const lastMessageIndex = prev.length - 1;
      if (prev[lastMessageIndex]?.sender === 'ai' && prev[lastMessageIndex]?.isLoading) {
        return prev.map((msg, index) => 
          index === lastMessageIndex 
          ? { 
              ...msg, 
              text: (msg.text && msg.text.trim() !== '') ? msg.text + "\n\n--- Generation stopped by user. ---" : "Generation stopped by user.", 
              isLoading: false, 
              isError: false 
            } 
          : msg
        );
      }
      return prev;
    });
  }, []);

  const handleStartChat = useCallback(async () => {
    if (selectedProviderKey === AIProvider.GOOGLE_GEMINI && !ai) {
      setError("Gemini API client is not initialized. Check API Key.");
      return;
    }
    if (!selectedModelId) {
        setError("No model selected. Please choose a model in the sidebar.");
        return;
    }
    if (!userInputText && !userImageFile) {
      setError("Please provide text or an image to start the analysis.");
      return;
    }

    isStoppingRef.current = false; // Reset stop flag for new operation
    setIsLoading(true);
    setError(null);
    setChatMessages([]); 

    let imageBase64: string | null = null;
    let imageMimeType: string | null = null;
    let imagePreviewUrl: string | undefined = undefined;

    if (userImageFile) {
      try {
        imagePreviewUrl = URL.createObjectURL(userImageFile);
        const base64WithMime = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(userImageFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
        });
        const parts = base64WithMime.split(',');
        if (parts.length === 2) {
            imageBase64 = parts[1];
            imageMimeType = userImageFile.type;
        } else {
            throw new Error("Invalid base64 image format.");
        }
      } catch (err) {
        console.error('Failed to process image file:', err);
        setError('Failed to process image file. Please try another image or check the console.');
        setIsLoading(false);
        if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl); 
        return;
      }
    }
    
    setCurrentSiftQueryDetails({ 
        userInputText: userInputText || '', 
        userImagePreviewUrl: imagePreviewUrl,
        reportType,
    });

    const userQueryMessage: ChatMessage = {
      id: uuidv4(),
      sender: 'user',
      text: userInputText || (userImageFile ? "(Image provided)" : ""), 
      timestamp: new Date(),
      imagePreviewUrl: imagePreviewUrl,
      originalQuery: { 
          text: userInputText,
          imageBase64: imageBase64,
          imageMimeType: imageMimeType,
          reportType: reportType,
      }
    };
    setChatMessages([userQueryMessage]);

    // Store details needed for a potential restart of this initial SIFT report
    const originalQueryForRestart: OriginalQueryInfo = {
        text: userInputText,
        imageBase64: imageBase64,
        imageMimeType: imageMimeType,
        reportType: reportType,
    };

    const currentSelectedModelConfig = AVAILABLE_PROVIDERS_MODELS.find(m => m.id === selectedModelId);
    const chatConfig: any = {
        systemInstruction: SIFT_CHAT_SYSTEM_PROMPT,
        ...modelConfigParams,
    };

    if (currentSelectedModelConfig?.supportsGoogleSearch) {
        chatConfig.tools = [{ googleSearch: {} }];
    }

    if (selectedProviderKey === AIProvider.GOOGLE_GEMINI && !ai) {
        setError("Gemini API client is not available. Cannot start chat.");
        setIsLoading(false);
        return;
    }

    const currentChat = ai!.chats.create({
        model: selectedModelId,
        config: chatConfig,
    });
    setChatSession(currentChat);

    const partsForGemini: Part[] = [];
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    let siftTaskInstructions = getSiftInstructionsForReportType(reportType);
    siftTaskInstructions = siftTaskInstructions.replace(/\[current date placeholder, will be provided in task\]/g, currentDate);
    siftTaskInstructions = siftTaskInstructions.replace(/\[current date\]/g, currentDate);

    let firstMessageContent = `Using the SIFT methodology, please perform a "${reportType}" analysis with the model "${currentSelectedModelConfig?.name || selectedModelId}". The current date is ${currentDate}.\n`;
    if (userInputText) {
      firstMessageContent += `User's textual input: "${userInputText}"\n`;
    }
    if (userImageFile && imageBase64 && imageMimeType) {
      firstMessageContent += `An image has been uploaded. Please analyze it as part of your SIFT process (describe, transcribe text if any, check provenance, etc.).\n`;
      partsForGemini.push({ inlineData: { data: imageBase64, mimeType: imageMimeType } });
    }
    firstMessageContent += `\nHere are the detailed SIFT instructions for this task:\n${siftTaskInstructions}\n--- TASK START ---`;
    partsForGemini.push({ text: firstMessageContent });

    setLastGenerationInput({
        partsToResend: [...partsForGemini], // Clone parts
        modelIdToUse: selectedModelId,
        chatConfigForInitial: { ...chatConfig }, // Clone config
        originalQueryForInitial: originalQueryForRestart,
        isInitialRestart: true,
        chatSessionForFollowup: null // Not used for initial
    });
    
    const aiResponseMessageId = uuidv4();
    setChatMessages(prev => [...prev, {
        id: aiResponseMessageId, 
        sender: 'ai', 
        text: '', 
        timestamp: new Date(), 
        isLoading: true, 
        modelId: selectedModelId,
        isInitialSIFTReport: true, 
        originalQueryReportType: reportType 
    }]);

    try {
      const resultStream = await currentChat.sendMessageStream({ message: partsForGemini });
      let currentText = '';
      let currentGroundingSources: GroundingChunk[] | undefined = undefined;

      for await (const chunk of resultStream) {
        if (isStoppingRef.current) break;
        currentText += chunk.text; 
        currentGroundingSources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(gc => ({
            web: gc.web ? { uri: gc.web.uri, title: gc.web.title || gc.web.uri } : undefined
        })).filter(Boolean) as GroundingChunk[] || currentGroundingSources;

        setChatMessages(prev => prev.map(msg => 
          msg.id === aiResponseMessageId ? { ...msg, text: currentText, isLoading: true, groundingSources: currentGroundingSources } : msg
        ));
      }

      if (isStoppingRef.current) {
        // Message update handled by handleStopGeneration
      } else {
        setChatMessages(prev => prev.map(msg => 
          msg.id === aiResponseMessageId ? { ...msg, text: currentText, isLoading: false, groundingSources: currentGroundingSources } : msg
        ));
      }
    } catch (err: any) {
      if (!isStoppingRef.current) {
        console.error("Error in initial chat message:", err);
        const errorMessage = err.message || 'An unexpected error occurred while generating the initial report.';
        setError(errorMessage);
        setChatMessages(prev => prev.map(msg => 
          msg.id === aiResponseMessageId ? { ...msg, text: `Error: ${errorMessage}`, isLoading: false, isError: true } : msg
        ));
      } else {
        console.warn("Stream error during stop:", err);
      }
    } finally {
      if (!isStoppingRef.current) {
        setIsLoading(false);
      }
    }
  }, [ai, userInputText, userImageFile, reportType, selectedModelId, modelConfigParams, selectedProviderKey, getSiftInstructionsForReportType, handleStopGeneration]);


  const handleSendChatMessage = useCallback(async (messageText: string, command?: 'another round' | 'read the room') => {
    if (!chatSession || (selectedProviderKey === AIProvider.GOOGLE_GEMINI && !ai)) {
      setError("Chat session is not active or AI client not initialized.");
      return;
    }
    if (!messageText.trim() && !command) {
        return;
    }

    const textToSend = command ? command : messageText;

    isStoppingRef.current = false; // Reset stop flag
    setIsLoading(true);
    setError(null);

    const userMessage: ChatMessage = {
      id: uuidv4(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, userMessage]);

    const partsForGemini: Part[] = [{ text: textToSend }];
    
    setLastGenerationInput({
        partsToResend: [...partsForGemini], // Clone parts
        modelIdToUse: selectedModelId,
        chatSessionForFollowup: chatSession, // Reference to the current session
        isInitialRestart: false,
        // Not used for follow-up restarts:
        chatConfigForInitial: undefined,
        originalQueryForInitial: undefined
    });

    const aiResponseMessageId = uuidv4();
    setChatMessages(prev => [...prev, {
        id: aiResponseMessageId, 
        sender: 'ai', 
        text: '', 
        timestamp: new Date(), 
        isLoading: true, 
        modelId: selectedModelId,
        isInitialSIFTReport: false 
    }]);
    
    try {
      // partsForGemini already defined above for setLastGenerationInput
      const resultStream = await chatSession.sendMessageStream({ message: partsForGemini });
      let currentText = '';
      let currentGroundingSources: GroundingChunk[] | undefined = undefined;

      for await (const chunk of resultStream) {
        if (isStoppingRef.current) break;
        currentText += chunk.text; 
        currentGroundingSources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(gc => ({
            web: gc.web ? { uri: gc.web.uri, title: gc.web.title || gc.web.uri } : undefined
        })).filter(Boolean) as GroundingChunk[] || currentGroundingSources;

        setChatMessages(prev => prev.map(msg => 
          msg.id === aiResponseMessageId ? { ...msg, text: currentText, isLoading: true, groundingSources: currentGroundingSources } : msg
        ));
      }
      
      if (isStoppingRef.current) {
        // Message update handled by handleStopGeneration
      } else {
        setChatMessages(prev => prev.map(msg => 
          msg.id === aiResponseMessageId ? { ...msg, text: currentText, isLoading: false, groundingSources: currentGroundingSources } : msg
        ));
      }
    } catch (err: any) {
      if (!isStoppingRef.current) {
        console.error("Error in chat message:", err);
        const errorMessageText = err.message || 'An unexpected error occurred while sending the chat message.';
        setError(errorMessageText); 
        setChatMessages(prev => prev.map(msg => 
          msg.id === aiResponseMessageId ? { ...msg, text: `Error: ${errorMessageText}`, isLoading: false, isError: true } : msg
        ));
      } else {
         console.warn("Stream error during stop:", err);
      }
    } finally {
      if (!isStoppingRef.current) {
        setIsLoading(false);
      }
    }
  }, [chatSession, ai, selectedModelId, selectedProviderKey, handleStopGeneration]);

  const handleRestartGeneration = useCallback(async () => {
    if (!lastGenerationInput) {
      setError("Nothing to restart. Last generation input not found.");
      return;
    }
    if (selectedProviderKey === AIProvider.GOOGLE_GEMINI && !ai) {
      setError("Gemini API client is not initialized. Cannot restart.");
      return;
    }

    if (isLoading) {
      handleStopGeneration(); // Stop current generation first
      // Give a moment for the stop to take effect
      isStoppingRef.current = true; // Ensure it's marked as stopping
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait a bit
    }
    
    isStoppingRef.current = false; // Reset for the new generation
    setIsLoading(true);
    setError(null);

    // Remove the last AI message that is being restarted
    // Also remove the user message that prompted it if it was a follow-up,
    // or keep the user message if it was an initial SIFT report (as it's part of the query panel)
    setChatMessages(prevMessages => {
        if (prevMessages.length === 0) return [];
        // If restarting a follow-up, the last two messages are user query and AI response.
        // If restarting an initial SIFT, the last message is the AI response, user query is first.
        if (lastGenerationInput.isInitialRestart) {
            // Find the AI message to remove (should be the last one if no follow-ups happened)
            // Or, more robustly, find the one that was loading or errored from the previous attempt.
            // For simplicity now, assume it's the last one if it's an AI message.
            const lastMsg = prevMessages[prevMessages.length -1];
            if (lastMsg?.sender === 'ai') {
                return prevMessages.slice(0, -1);
            }
            return prevMessages; // Should not happen if restart is valid
        } else {
             // For follow-up, remove last user message and last AI message
            if (prevMessages.length >= 2) {
                return prevMessages.slice(0, -2);
            }
            return []; // Or handle error
        }
    });
    
    // Brief pause to allow UI to update from chat message removal
    await new Promise(resolve => setTimeout(resolve, 50));


    let streamSourceChat: Chat | null = null;
    let userQueryMessageForDisplay: ChatMessage | null = null;

    if (lastGenerationInput.isInitialRestart && lastGenerationInput.originalQueryForInitial) {
      const { text, imageBase64, imageMimeType, reportType: originalReportType } = lastGenerationInput.originalQueryForInitial;
      
      let imagePreviewUrlForRestart: string | undefined = undefined;
      if (imageBase64 && imageMimeType) {
          // Recreate a blob URL for preview if image data exists.
          // This is a simplified approach; in a real app, you might want to cache the blob URL
          // or handle this more robustly if the original File object isn't available.
          try {
            const byteCharacters = atob(imageBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: imageMimeType });
            imagePreviewUrlForRestart = URL.createObjectURL(blob);
            // Note: This URL should be revoked later, e.g., when chat clears or component unmounts
          } catch (e) {
            console.error("Error recreating blob URL for restart:", e);
          }
      }

      setCurrentSiftQueryDetails({
        userInputText: text || '',
        userImagePreviewUrl: imagePreviewUrlForRestart,
        reportType: originalReportType,
      });

      userQueryMessageForDisplay = {
        id: uuidv4(),
        sender: 'user',
        text: text || (imageBase64 ? "(Image provided for restart)" : "(Restarting initial query)"),
        timestamp: new Date(),
        imagePreviewUrl: imagePreviewUrlForRestart,
        originalQuery: lastGenerationInput.originalQueryForInitial,
      };
      setChatMessages(prev => [userQueryMessageForDisplay!]); // Start with the user query message

      if (!ai) { // Should be caught earlier, but double check
          setError("AI client not available for initial restart.");
          setIsLoading(false);
          return;
      }
      streamSourceChat = ai.chats.create({
        model: lastGenerationInput.modelIdToUse,
        config: lastGenerationInput.chatConfigForInitial,
      });
      setChatSession(streamSourceChat); // Update main chat session to the new one for initial SIFT
    } else if (!lastGenerationInput.isInitialRestart && lastGenerationInput.chatSessionForFollowup) {
      streamSourceChat = lastGenerationInput.chatSessionForFollowup;
      // For follow-up, the user message that prompted it should be re-added
      const originalUserText = lastGenerationInput.partsToResend.find(p => p.text)?.text || "(Restarting follow-up)";
      userQueryMessageForDisplay = {
        id: uuidv4(),
        sender: 'user',
        text: originalUserText,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, userQueryMessageForDisplay!]);
    }

    if (!streamSourceChat) {
      setError("Chat session not available for restart.");
      setIsLoading(false);
      return;
    }

    const aiResponseMessageId = uuidv4();
    setChatMessages(prev => [...prev, {
        id: aiResponseMessageId,
        sender: 'ai',
        text: '',
        timestamp: new Date(),
        isLoading: true,
        modelId: lastGenerationInput.modelIdToUse,
        isInitialSIFTReport: lastGenerationInput.isInitialRestart,
        originalQueryReportType: lastGenerationInput.isInitialRestart ? lastGenerationInput.originalQueryForInitial?.reportType : undefined
    }]);

    // Update lastGenerationInput to reflect this new attempt, so it can be restarted again
    // This is important if the restarted generation itself is stopped.
    setLastGenerationInput(prevLGI => prevLGI ? {
        ...prevLGI, // Keep original config/session details
        partsToResend: [...lastGenerationInput!.partsToResend] // Ensure parts are current
    } : null);

    try {
      const resultStream = await streamSourceChat.sendMessageStream({ message: lastGenerationInput.partsToResend });
      let currentText = '';
      let currentGroundingSources: GroundingChunk[] | undefined = undefined;

      for await (const chunk of resultStream) {
        if (isStoppingRef.current) break;
        currentText += chunk.text;
        currentGroundingSources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(gc => ({
            web: gc.web ? { uri: gc.web.uri, title: gc.web.title || gc.web.uri } : undefined
        })).filter(Boolean) as GroundingChunk[] || currentGroundingSources;

        setChatMessages(prev => prev.map(msg =>
          msg.id === aiResponseMessageId ? { ...msg, text: currentText, isLoading: true, groundingSources: currentGroundingSources } : msg
        ));
      }

      if (isStoppingRef.current) {
        // Message update handled by handleStopGeneration logic (implicitly, as it sets isLoading false)
        // Or, explicitly ensure the message is marked as stopped if handleStopGeneration wasn't fully effective
         setChatMessages(prev => prev.map(msg =>
          msg.id === aiResponseMessageId
          ? {
              ...msg,
              text: (currentText && currentText.trim() !== '') ? currentText + "\n\n--- Generation stopped by user (during restart). ---" : "Generation stopped by user (during restart).",
              isLoading: false,
              isError: false
            }
          : msg
        ));
      } else {
        setChatMessages(prev => prev.map(msg =>
          msg.id === aiResponseMessageId ? { ...msg, text: currentText, isLoading: false, groundingSources: currentGroundingSources } : msg
        ));
      }
    } catch (err: any) {
      if (!isStoppingRef.current) {
        console.error("Error in restarted chat message:", err);
        const errorMessage = err.message || 'An unexpected error occurred while regenerating the message.';
        setError(errorMessage);
        setChatMessages(prev => prev.map(msg =>
          msg.id === aiResponseMessageId ? { ...msg, text: `Error: ${errorMessage}`, isLoading: false, isError: true } : msg
        ));
      } else {
        console.warn("Stream error during stop (restart):", err);
      }
    } finally {
      // Only set isLoading to false if not stopped by an external 'stop' call that already handled it
      if (!isStoppingRef.current) {
         setIsLoading(false);
      }
      // If an image preview URL was created for restart, revoke it if it's for an initial SIFT
      // This is a bit tricky as the URL might be used by the ChatMessageItem.
      // A more robust solution would manage these URLs lifecycle carefully.
      // For now, we won't revoke immediately to avoid breaking the display.
      // if (lastGenerationInput.isInitialRestart && lastGenerationInput.originalQueryForInitial?.imageBase64 && userQueryMessageForDisplay?.imagePreviewUrl) {
      //   URL.revokeObjectURL(userQueryMessageForDisplay.imagePreviewUrl);
      // }
    }
  }, [ai, isLoading, lastGenerationInput, selectedProviderKey, handleStopGeneration, chatSession]);


  useEffect(() => {
     if (chatMessagesContainerRef.current && chatMessages.length > 0) {
        chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const isChatActive = chatMessages.length > 0;
  const currentModelDetails = AVAILABLE_PROVIDERS_MODELS.find(m => m.id === selectedModelId);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-slate-100">
      <header className="w-full p-4 sm:p-6 text-center shrink-0 border-b border-slate-700">
        <div className="flex items-center justify-center space-x-3 mb-2">
          <span className="text-3xl sm:text-4xl" aria-hidden="true">{SIFT_ICON}</span>
          <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-500">
            SIFT Toolbox
          </h1>
        </div>
        <p className="text-slate-400 text-base sm:text-lg">
          Interactive SIFT analysis and chat. Current Model: {currentModelDetails?.name || 'N/A'}
        </p>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        {currentSiftQueryDetails && isChatActive && (
            <UserQueryPanel 
                userInputText={currentSiftQueryDetails.userInputText}
                userImagePreviewUrl={currentSiftQueryDetails.userImagePreviewUrl}
                reportType={currentSiftQueryDetails.reportType}
            />
        )}
        
        <div className="flex-1 flex flex-col overflow-y-auto relative">
          <main className="w-full max-w-7xl mx-auto flex-grow flex flex-col p-4 sm:px-6 lg:px-8 py-6">
            {!apiKey && selectedProviderKey === AIProvider.GOOGLE_GEMINI && (
              <div className="p-4">
                  <ErrorAlert message="Critical: API Key (VITE_GEMINI_API_KEY environment variable) is not set or accessible for Google Gemini. The application cannot function for this provider." />
              </div>
            )}

            {!isChatActive && (selectedProviderKey === AIProvider.GOOGLE_GEMINI ? (apiKey && ai) : true) && (
              <div className="bg-slate-800 shadow-2xl rounded-xl p-6 sm:p-8">
                <InputForm
                  userInputText={userInputText}
                  setUserInputText={setUserInputText}
                  userImageFile={userImageFile}
                  setUserImageFile={setUserImageFile}
                  reportType={reportType}
                  setReportType={setReportType}
                  onStartChat={handleStartChat}
                  isLoading={isLoading}
                  isChatActive={isChatActive}
                  onStopGeneration={handleStopGeneration}
                />
              </div>
            )}
            
            {isLoading && !isChatActive && (
              <>
                <LoadingSpinner />
              </>
            )} 
            {error && (
              <>
                <ErrorAlert message={error} />
              </>
            )}

            {isChatActive && (selectedProviderKey === AIProvider.GOOGLE_GEMINI ? (apiKey && ai) : true) && (
              <ChatInterface
                messages={chatMessages}
                onSendMessage={handleSendChatMessage}
                isLoading={isLoading}
                onStopGeneration={handleStopGeneration}
                onRestartGeneration={handleRestartGeneration}
                canRestart={!!lastGenerationInput && !isLoading && chatMessages.some(msg => msg.sender === 'ai' && (!msg.isLoading || msg.isError))}
                ref={chatMessagesContainerRef}
              />
            )}
          </main>
        </div>

        <Sidebar
            availableModels={AVAILABLE_PROVIDERS_MODELS}
            selectedProviderKey={selectedProviderKey}
            onSelectProvider={(providerKey) => {
                setSelectedProviderKey(providerKey);
                const firstModelOfNewProvider = AVAILABLE_PROVIDERS_MODELS.find(m => m.provider === providerKey);
                if (firstModelOfNewProvider) {
                    setSelectedModelId(firstModelOfNewProvider.id);
                    const newParams: ConfigurableParams = {};
                    firstModelOfNewProvider.parameters.forEach(p => newParams[p.key] = p.defaultValue);
                    setModelConfigParams(newParams);
                } else {
                    setSelectedModelId(''); 
                    setModelConfigParams({});
                }
            }}
            selectedModelId={selectedModelId}
            onSelectModelId={(modelId) => {
                setSelectedModelId(modelId);
                const newModel = AVAILABLE_PROVIDERS_MODELS.find(m => m.id === modelId);
                if (newModel) {
                    const newParams: ConfigurableParams = {};
                    newModel.parameters.forEach(p => newParams[p.key] = p.defaultValue);
                    setModelConfigParams(newParams);
                }
            }}
            modelConfigParams={modelConfigParams}
            onModelConfigParamChange={(key, value) => setModelConfigParams(prev => ({...prev, [key]: value}))}
            onClearChatAndReset={handleClearChatAndReset}
            isChatActive={isChatActive}
         />
      </div>

      <footer className="w-full max-w-7xl mx-auto p-4 text-center text-slate-500 text-xs sm:text-sm shrink-0 border-t border-slate-700">
        <p>&copy; {new Date().getFullYear()} SIFT Toolbox Report Builder. Powered by {selectedProviderKey.replace('_', ' ')}.</p>
      </footer>
    </div>
  )
};

export default App;