import React, { useState } from 'react';
import { extractUrlContent, ExtractedUrlData } from '../services/apiClient';

interface UrlExtractionPanelProps {
  onUrlExtracted?: (data: ExtractedUrlData) => void;
  className?: string;
}

export const UrlExtractionPanel: React.FC<UrlExtractionPanelProps> = ({
  onUrlExtracted,
  className = ''
}) => {
  const [url, setUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedUrlData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forceRefresh, setForceRefresh] = useState(false);

  const handleExtract = async () => {
    if (!url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    setIsExtracting(true);
    setError(null);
    setExtractedData(null);

    try {
      const data = await extractUrlContent({
        url: url.trim(),
        forceRefresh,
        timeout: 15
      });

      setExtractedData(data);
      onUrlExtracted?.(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract URL content';
      setError(errorMessage);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isExtracting) {
      handleExtract();
    }
  };

  const resetForm = () => {
    setUrl('');
    setExtractedData(null);
    setError(null);
    setForceRefresh(false);
  };

  return (
    <div className={`bg-slate-800 rounded-lg p-4 border border-slate-700 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-sky-400">Extract URL Content</h3>
        {extractedData && (
          <button
            onClick={resetForm}
            className="text-sm text-slate-400 hover:text-sky-400 transition-colors"
          >
            Extract Another
          </button>
        )}
      </div>

      {!extractedData && (
        <div className="space-y-4">
          <div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter URL to extract content..."
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              disabled={isExtracting}
            />
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
                className="rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                disabled={isExtracting}
              />
              <span>Force refresh</span>
            </label>

            <button
              onClick={handleExtract}
              disabled={isExtracting || !url.trim()}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-md transition-colors text-sm font-medium"
            >
              {isExtracting ? 'Extracting...' : 'Extract'}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded-md text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>
      )}

      {extractedData && (
        <div className="space-y-4">
          <div className="p-3 bg-green-900/30 border border-green-700 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-300">
                {extractedData.from_cache ? 'Retrieved from cache' : 'Extracted successfully'}
              </span>
              <span className="text-xs text-slate-400">
                {new Date(extractedData.processed_at).toLocaleString()}
              </span>
            </div>
            
            {extractedData.title && (
              <h4 className="font-semibold text-slate-200 mb-2">{extractedData.title}</h4>
            )}
            
            <p className="text-sm text-slate-300 mb-2">
              <span className="font-medium">URL:</span>{' '}
              <a 
                href={extractedData.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sky-400 hover:text-sky-300 underline break-all"
              >
                {extractedData.url}
              </a>
            </p>

            {extractedData.extraction_meta && (
              <div className="text-xs text-slate-400 space-y-1">
                {extractedData.extraction_meta.word_count && (
                  <p>Word count: {extractedData.extraction_meta.word_count.toLocaleString()}</p>
                )}
                {extractedData.extraction_meta.content_length && (
                  <p>Content size: {(extractedData.extraction_meta.content_length / 1024).toFixed(1)} KB</p>
                )}
              </div>
            )}
          </div>

          {extractedData.content_preview && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-indigo-300">Content Preview:</h5>
              <div className="p-3 bg-slate-700 rounded-md max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-slate-600">
                <p className="text-sm text-slate-200 leading-relaxed">
                  {extractedData.content_preview}
                </p>
              </div>
            </div>
          )}

          <div className="flex space-x-2">
            <button
              onClick={() => navigator.clipboard.writeText(extractedData.content || extractedData.content_preview || '')}
              className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-slate-200 rounded transition-colors"
            >
              Copy Content
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(extractedData.url)}
              className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-slate-200 rounded transition-colors"
            >
              Copy URL
            </button>
          </div>
        </div>
      )}
    </div>
  );
};