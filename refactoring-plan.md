# SIFT Toolbox App.tsx Refactoring Plan

## Overview
This document outlines the plan for refactoring the App.tsx component to remove all direct interactions with AI SDKs and API key management, as this functionality has been moved to the backend.

## Components to Remove

### Import Statements
- Remove imports for AI SDKs:
  ```typescript
  import { GoogleGenAI, Chat, Part } from "@google/genai";
  import OpenAI from 'openai';
  ```

### State Variables
- Remove API key state variables:
  ```typescript
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
  const [openaiApiKey, setOpenaiApiKey] = useState<string | null>(null);
  const [openrouterApiKey, setOpenrouterApiKey] = useState<string | null>(null);
  ```

- Remove AI client instance state variables:
  ```typescript
  const [geminiAi, setGeminiAi] = useState<GoogleGenAI | null>(null);
  const [openaiClient, setOpenaiClient] = useState<OpenAI | null>(null);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [currentOpenAIChatHistory, setCurrentOpenAIChatHistory] = useState<OpenAI.Chat.Completions.ChatCompletionMessageParam[]>([]);
  ```

- Remove preprocessing state variables:
  ```typescript
  const [enableGeminiPreprocessing, setEnableGeminiPreprocessing] = useState<boolean>(false);
  const [geminiPreprocessingOutputText, setGeminiPreprocessingOutputText] = useState<string | null>(null);
  ```

### useEffect Hooks
- Remove useEffect hooks that initialize AI clients based on API keys:
  - Lines 107-124: API key initialization from environment variables
  - Lines 142-204: AI client initialization
  - Lines 630-632: API key checking effect

### Helper Functions
- Remove utility functions specific to frontend AI SDKs:
  - `fileToGenerativePart` (lines 258-270)
  - `checkAPIKeysAndSetError` (lines 601-627)

### UI Elements
- Remove footer elements displaying API key loaded status (lines 826-834)

## Code Sections to Modify

### handleStartChat Function
- The function already uses `initiateSiftAnalysis` from apiClient.ts, but contains references to removed state variables
- Simplify to focus on:
  - Creating user message
  - Setting up AI message placeholder
  - Calling backend API
  - Handling SSE connection

### handleSendChatMessage Function
- Currently uses direct SDK calls for follow-up messages
- Modify to use backend API for follow-up messages

### handleToggleGeminiPreprocessing Function
- Remove this function as preprocessing will be handled by the backend

### handleRestartGeneration Function
- Simplify to remove references to preprocessing and direct SDK interactions

### Footer Section
- Remove or update the footer to remove API key status information

## Implementation Steps

1. Remove unnecessary imports
2. Remove API key and AI client state variables
3. Remove initialization useEffect hooks
4. Remove helper functions specific to frontend AI SDKs
5. Simplify handleStartChat function
6. Modify handleSendChatMessage to use backend API
7. Update UI to remove API key status information
8. Test the refactored component

## Next Steps

After implementing these changes, we should:
1. Test the application to ensure it works correctly with the backend
2. Update any documentation to reflect the new architecture
3. Consider adding error handling for backend API failures