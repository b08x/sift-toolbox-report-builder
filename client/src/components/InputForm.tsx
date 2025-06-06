
import React, { useState, ChangeEvent, useEffect } from 'react';
import { ReportType } from '../types';

interface InputFormProps {
  userInputText: string;
  setUserInputText: (text: string) => void;
  userImageFile: File | null;
  setUserImageFile: (file: File | null) => void;
  reportType: ReportType;
  setReportType: (type: ReportType) => void;
  onStartChat: () => void;
  isLoading: boolean;
  isChatActive: boolean;
  onStopGeneration?: () => void;
  selectedModelSupportsVision: boolean; // New prop
}

const placeholderExamples = [
  "Example: 'A photo shows flooding in downtown Miami during Hurricane Ian.'",
  "Example: 'Scientists say coffee prevents heart disease according to new study.'",
  "Example: 'This image claims to show the largest protest in Washington DC history.'",
  "Example: URL analysis - paste any news article or social media link.",
  "Example: 'What's the context behind this viral video of a politician?'",
  "Example: 'Is this quote attributed to Abraham Lincoln accurate?'"
];

const PLACEHOLDER_CHANGE_INTERVAL = 4000; // 4 seconds

export const InputForm: React.FC<InputFormProps> = ({
  userInputText,
  setUserInputText,
  userImageFile,
  setUserImageFile,
  reportType,
  setReportType,
  onStartChat,
  isLoading,
  isChatActive,
  onStopGeneration,
  selectedModelSupportsVision,
}) => {
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);

  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (!isLoading && !isChatActive) {
      timerId = setInterval(() => {
        setCurrentPlaceholderIndex((prevIndex) => (prevIndex + 1) % placeholderExamples.length);
      }, PLACEHOLDER_CHANGE_INTERVAL);
    }
    return () => clearInterval(timerId);
  }, [isLoading, isChatActive]);

  // Clear image if model doesn't support vision
  useEffect(() => {
    if (!selectedModelSupportsVision && userImageFile) {
      setUserImageFile(null);
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
        setImagePreviewUrl(null);
      }
    }
  }, [selectedModelSupportsVision, userImageFile, setUserImageFile, imagePreviewUrl]);


  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedModelSupportsVision) return; // Prevent change if model doesn't support vision

    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setUserImageFile(file);
      const newPreviewUrl = URL.createObjectURL(file);
      if (imagePreviewUrl) { 
        URL.revokeObjectURL(imagePreviewUrl);
      }
      setImagePreviewUrl(newPreviewUrl);
    } else {
      setUserImageFile(null);
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      setImagePreviewUrl(null);
    }
  };
  
  const fieldsetDisabled = isChatActive || isLoading;
  const canStart = userInputText.trim() !== '' || (userImageFile !== null && selectedModelSupportsVision);
  const generateButtonDisabled = isLoading ? false : (isChatActive || !canStart);
  const imageInputDisabled = fieldsetDisabled || !selectedModelSupportsVision;

  return (
    <div className={`space-y-6 mb-8 ${isChatActive && !isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <fieldset disabled={fieldsetDisabled} className="space-y-6">
        <div>
          <label htmlFor="userText" className="block text-sm font-medium text-sky-300 mb-1">
            Initial Text/Claim to Analyze
          </label>
          <textarea
            id="userText"
            rows={4}
            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-slate-100 placeholder-slate-400 disabled:bg-slate-600 disabled:cursor-not-allowed"
            placeholder={fieldsetDisabled ? "Input disabled during chat/loading..." : placeholderExamples[currentPlaceholderIndex]}
            value={userInputText}
            onChange={(e) => setUserInputText(e.target.value)}
            disabled={fieldsetDisabled}
            aria-label="Text input for SIFT analysis"
          />
        </div>

        <div>
          <label htmlFor="userImage" className="block text-sm font-medium text-sky-300 mb-1">
            Upload Image (Optional, if model supports vision)
          </label>
          <input
            type="file"
            id="userImage"
            accept="image/*"
            onChange={handleImageChange}
            className={`block w-full text-sm text-slate-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-indigo-600 file:text-sky-100
              hover:file:bg-indigo-500
              disabled:file:bg-indigo-800 disabled:file:cursor-not-allowed ${imageInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={imageInputDisabled}
            aria-label="Image upload for SIFT analysis"
            title={!selectedModelSupportsVision ? "Selected model does not support image input" : "Upload an image"}
          />
          {!selectedModelSupportsVision && (
            <p className="text-xs text-amber-400 mt-1">
              The currently selected model does not support image analysis. Image upload is disabled.
            </p>
          )}
          {imagePreviewUrl && selectedModelSupportsVision && !isChatActive && (
            <div className="mt-4">
              <p className="text-sm text-slate-400 mb-1">Image Preview:</p>
              <img src={imagePreviewUrl} alt="Preview of uploaded image" className="max-h-48 rounded-md border border-slate-600" />
            </div>
          )}
        </div>

        <div>
          <label htmlFor="reportType" className="block text-sm font-medium text-sky-300 mb-1">
            Initial Report Type (Full Check recommended for chat)
          </label>
          <select
            id="reportType"
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-slate-100 disabled:bg-slate-600 disabled:cursor-not-allowed"
            disabled={fieldsetDisabled}
            aria-label="Select SIFT report type"
          >
            {Object.values(ReportType).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <button
        onClick={isLoading ? onStopGeneration : onStartChat}
        disabled={generateButtonDisabled}
        className={`w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white 
          ${isLoading 
            ? 'bg-red-600 hover:bg-red-500 focus:ring-red-500' 
            : 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 focus:ring-indigo-500'}
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 
          disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out`}
        aria-label={isLoading ? "Cancel SIFT Analysis Generation" : (isChatActive ? "Chat already active, use chat input below" : "Start SIFT Analysis Chat")}
      >
        {isLoading && onStopGeneration ? ( 
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Cancel Generation
          </>
        ) : (
          'Start SIFT Analysis Chat'
        )}
      </button>
      {isChatActive && !isLoading && <p className="text-sm text-center text-sky-400 mt-2">Chat is active. Use the chat input below to continue.</p>}
    </div>
  );
};