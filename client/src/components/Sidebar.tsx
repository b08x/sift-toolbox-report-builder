
import React from 'react';
import { AIProvider, AIModelConfig, ModelParameter, ConfigurableParams } from '../types';
import { SliderInput } from './SliderInput'; 

interface SidebarProps {
  availableModels: AIModelConfig[];
  selectedProviderKey: AIProvider;
  onSelectProvider: (provider: AIProvider) => void;
  selectedModelId: string;
  onSelectModelId: (modelId: string) => void;
  modelConfigParams: ConfigurableParams;
  onModelConfigParamChange: (key: string, value: number | string) => void;
  onClearChatAndReset: () => void;
  isChatActive: boolean;
  modelsLoading: boolean;
  modelsError: string | null;
  // enableGeminiPreprocessing: boolean; // Prop removed
  // onToggleGeminiPreprocessing: (enabled: boolean) => void; // Prop removed
}

export const Sidebar: React.FC<SidebarProps> = ({
  availableModels,
  selectedProviderKey,
  onSelectProvider,
  selectedModelId,
  onSelectModelId,
  modelConfigParams,
  onModelConfigParamChange,
  onClearChatAndReset,
  isChatActive,
  modelsLoading,
  modelsError,
  // enableGeminiPreprocessing, // Prop removed
  // onToggleGeminiPreprocessing, // Prop removed
}) => {
  const handleProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newProviderKey = event.target.value as AIProvider;
    onSelectProvider(newProviderKey);
    // Auto-select the first model of the new provider
    const firstModelOfNewProvider = availableModels.find(m => m.provider === newProviderKey);
    if (firstModelOfNewProvider) {
      onSelectModelId(firstModelOfNewProvider.id);
    }
  };

  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onSelectModelId(event.target.value);
  };

  const modelsForSelectedProvider = availableModels.filter(m => m.provider === selectedProviderKey);
  const selectedModelConfig = modelsForSelectedProvider.find(m => m.id === selectedModelId);

  const uniqueProviders = Array.from(new Set(availableModels.map(m => m.provider)));

  return (
    <aside className="w-64 md:w-80 bg-slate-800/60 p-4 shadow-lg flex-shrink-0 h-full overflow-y-auto border-r border-slate-700 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700/50">
      <h2 className="text-lg font-semibold text-sky-400 mb-4 sticky top-0 bg-slate-800/80 backdrop-blur-sm py-3 -mt-4 -mx-4 px-4 border-b border-slate-700 z-10">
        Configuration
      </h2>
      
      <div className="space-y-5">
        {/* Loading and Error States */}
        {modelsLoading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-400 mx-auto mb-2"></div>
            <p className="text-sm text-slate-400">Loading models...</p>
          </div>
        )}
        
        {modelsError && (
          <div className="bg-red-900/20 border border-red-700 rounded-md p-3">
            <p className="text-sm text-red-400 font-medium">Failed to load models</p>
            <p className="text-xs text-red-300 mt-1">{modelsError}</p>
          </div>
        )}
        
        {!modelsLoading && !modelsError && availableModels.length === 0 && (
          <div className="bg-amber-900/20 border border-amber-700 rounded-md p-3">
            <p className="text-sm text-amber-400 font-medium">No models available</p>
            <p className="text-xs text-amber-300 mt-1">Check your API key configuration</p>
          </div>
        )}

        {/* Provider Selection */}
        {!modelsLoading && availableModels.length > 0 && (
        <>
        <div>
          <label htmlFor="providerSelect" className="block text-sm font-medium text-indigo-300 mb-1">
            AI Provider
          </label>
          <select
            id="providerSelect"
            value={selectedProviderKey}
            onChange={handleProviderChange}
            disabled={uniqueProviders.length <= 1} 
            className="w-full p-2 text-sm bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-slate-100 disabled:bg-slate-600 disabled:opacity-70"
          >
            {uniqueProviders.map(provider => (
              <option key={provider} value={provider}>
                {provider.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        {/* Model Selection */}
        <div>
          <label htmlFor="modelSelect" className="block text-sm font-medium text-indigo-300 mb-1">
            Model
          </label>
          <select
            id="modelSelect"
            value={selectedModelId}
            onChange={handleModelChange}
            disabled={modelsForSelectedProvider.length === 0 || isChatActive} // Disable if chat active
            className="w-full p-2 text-sm bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-slate-100 disabled:bg-slate-600 disabled:opacity-70"
          >
            {modelsForSelectedProvider.length > 0 ? (
              modelsForSelectedProvider.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))
            ) : (
              <option value="" disabled>No models for this provider</option>
            )}
          </select>
                </div>
        
                {/* Gemini Preprocessing Toggle for OpenRouter - Removed as this is now backend-driven */}
                {/* The UI for this toggle might be re-introduced if the backend provides a way to control this behavior per-request */}
        
        
                {/* Dynamic Model Parameters */}
                {selectedModelConfig && selectedModelConfig.parameters.length > 0 && (
          <div className="pt-3 border-t border-slate-700/50">
            <h3 className="text-sm font-medium text-indigo-300 mb-2">
              Parameters ({selectedModelConfig.name})
            </h3>
            <div className="space-y-3">
              {selectedModelConfig.parameters.map((param: ModelParameter) => {
                if (param.type === 'slider' && param.min !== undefined && param.max !== undefined && param.step !== undefined) {
                  return (
                    <SliderInput
                      key={param.key}
                      id={`${selectedModelConfig.id}-${param.key}`}
                      label={param.label}
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      value={Number(modelConfigParams[param.key]) || Number(param.defaultValue)}
                      onChange={(value) => onModelConfigParamChange(param.key, value)}
                      description={param.description}
                      unit={param.unit}
                      disabled={isChatActive} 
                    />
                  );
                }
                return null; 
              })}
            </div>
          </div>
        )}
         {isChatActive && (
             <p className="text-xs text-amber-400 italic pt-2">Model selection & parameters are locked during an active chat. Clear chat to change.</p>
         )}
        </>
        )}

        {/* Session Control */}
        <div className="pt-3 border-t border-slate-700/50">
          <h3 className="text-sm font-medium text-indigo-300 mb-2">Session</h3>
          <button
            onClick={onClearChatAndReset}
            className="w-full p-2 text-sm bg-red-600 hover:bg-red-500 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-red-500 transition-colors disabled:opacity-60"
          >
            Clear Chat & Reset Form
          </button>
        </div>
      </div>

      <div className="mt-auto pt-6 text-center text-xs text-slate-500">
        <p>SIFT Toolbox v1.2</p>
      </div>
    </aside>
  );
};
