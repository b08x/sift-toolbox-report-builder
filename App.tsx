
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat, Part, GenerateContentResponse, Content } from "@google/genai";
import { v4 as uuidv4 } from 'uuid';

import { InputForm } from './components/InputForm';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorAlert } from './components/ErrorAlert';
import { ChatInterface } from './components/ChatInterface';
import { Sidebar } from './components/Sidebar';
import { UserQueryPanel } from './components/UserQueryPanel'; // New component
import { ReportType, ChatMessage, GroundingChunk, AIProvider, AIModelConfig, ConfigurableParams, ModelParameter, CurrentSiftQueryDetails } from './types';
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

  const [selectedProviderKey, setSelectedProviderKey] = useState<AIProvider>(AIProvider.GOOGLE_GEMINI);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [modelConfigParams, setModelConfigParams] = useState<ConfigurableParams>({});

  const [currentSiftQueryDetails, setCurrentSiftQueryDetails] = useState<CurrentSiftQueryDetails | null>(null);

  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const envApiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (envApiKey) {
      setApiKey(envApiKey);
      try {
        if (selectedProviderKey === AIProvider.GOOGLE_GEMINI) {
          const genAI = new GoogleGenAI({ apiKey: envApiKey });
          setAi(genAI);
        } else {
          setError("Selected provider is not yet supported for API client initialization.");
          setAi(null); // Ensure AI client is null for unsupported providers
        }
      } catch (e: any) {
        setError(`Failed to initialize API for ${selectedProviderKey}: ${e.message}. Ensure API key is valid.`);
        console.error("API Initialization Error:", e);
        setAi(null);
      }
    } else {
       setError("API Key (VITE_GEMINI_API_KEY environment variable) is not set or accessible for the primary provider. The application may not function correctly.");
       setAi(null);
    }
  }, [selectedProviderKey]);

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
    setChatMessages([]);
    setChatSession(null);
    setUserInputText('');
    setUserImageFile(null);
    setCurrentSiftQueryDetails(null); 
    setError(null);
    setIsLoading(false);
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
        if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl); // Clean up preview URL
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
        currentText += chunk.text; 
        currentGroundingSources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(gc => ({
            web: gc.web ? { uri: gc.web.uri, title: gc.web.title || gc.web.uri } : undefined
        })).filter(Boolean) as GroundingChunk[] || currentGroundingSources;

        setChatMessages(prev => prev.map(msg => 
          msg.id === aiResponseMessageId ? { ...msg, text: currentText, isLoading: true, groundingSources: currentGroundingSources } : msg
        ));
      }
      setChatMessages(prev => prev.map(msg => 
        msg.id === aiResponseMessageId ? { ...msg, text: currentText, isLoading: false, groundingSources: currentGroundingSources } : msg
      ));
    } catch (err: any) {
      console.error("Error in initial chat message:", err);
      const errorMessage = err.message || 'An unexpected error occurred while generating the initial report.';
      setError(errorMessage);
      setChatMessages(prev => prev.map(msg => 
        msg.id === aiResponseMessageId ? { ...msg, text: `Error: ${errorMessage}`, isLoading: false, isError: true } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  }, [ai, userInputText, userImageFile, reportType, selectedModelId, modelConfigParams, selectedProviderKey, getSiftInstructionsForReportType]);


  const handleSendChatMessage = useCallback(async (messageText: string, command?: 'another round' | 'read the room') => {
    if (!chatSession || (selectedProviderKey === AIProvider.GOOGLE_GEMINI && !ai)) {
      setError("Chat session is not active or AI client not initialized.");
      return;
    }
    if (!messageText.trim() && !command) {
        return;
    }

    const textToSend = command ? command : messageText;

    setIsLoading(true);
    setError(null);

    const userMessage: ChatMessage = {
      id: uuidv4(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, userMessage]);

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
      const partsForGemini: Part[] = [{ text: textToSend }];
      const resultStream = await chatSession.sendMessageStream({ message: partsForGemini });
      let currentText = '';
      let currentGroundingSources: GroundingChunk[] | undefined = undefined;

      for await (const chunk of resultStream) {
        currentText += chunk.text; 
        currentGroundingSources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(gc => ({
            web: gc.web ? { uri: gc.web.uri, title: gc.web.title || gc.web.uri } : undefined
        })).filter(Boolean) as GroundingChunk[] || currentGroundingSources;

        setChatMessages(prev => prev.map(msg => 
          msg.id === aiResponseMessageId ? { ...msg, text: currentText, isLoading: true, groundingSources: currentGroundingSources } : msg
        ));
      }
      setChatMessages(prev => prev.map(msg => 
        msg.id === aiResponseMessageId ? { ...msg, text: currentText, isLoading: false, groundingSources: currentGroundingSources } : msg
      ));
    } catch (err: any) {
      console.error("Error in chat message:", err);
      const errorMessageText = err.message || 'An unexpected error occurred while sending the chat message.';
      setError(errorMessageText); 
      setChatMessages(prev => prev.map(msg => 
        msg.id === aiResponseMessageId ? { ...msg, text: `Error: ${errorMessageText}`, isLoading: false, isError: true } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  }, [chatSession, ai, selectedModelId, selectedProviderKey]);


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
