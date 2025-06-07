import React, { useState } from 'react';
import { ExtractedUrlData } from '../services/apiClient';

interface ExtractedUrlDisplayProps {
  urlData: ExtractedUrlData;
  showFullContent?: boolean;
  className?: string;
}

export const ExtractedUrlDisplay: React.FC<ExtractedUrlDisplayProps> = ({
  urlData,
  showFullContent = false,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(showFullContent);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied'>('idle');

  const handleCopyContent = async () => {
    if (!urlData.content) return;
    
    setCopyStatus('copying');
    try {
      await navigator.clipboard.writeText(urlData.content);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      setCopyStatus('idle');
      console.error('Failed to copy content:', err);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(urlData.url);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const contentToShow = isExpanded ? urlData.content : urlData.content_preview;
  const hasMoreContent = urlData.content && urlData.content.length > (urlData.content_preview?.length || 0);

  return (
    <div className={`bg-slate-750 border border-slate-600 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          {urlData.title && (
            <h4 className="font-semibold text-slate-200 mb-1 leading-tight">
              {urlData.title}
            </h4>
          )}
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span>🔗</span>
            <a 
              href={urlData.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sky-400 hover:text-sky-300 underline truncate max-w-xs"
              title={urlData.url}
            >
              {new URL(urlData.url).hostname}
            </a>
            {urlData.from_cache && (
              <span className="px-1.5 py-0.5 bg-yellow-900/30 text-yellow-300 rounded text-xs">
                Cached
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-1 ml-4">
          <button
            onClick={handleCopyUrl}
            className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors rounded"
            title="Copy URL"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
          
          {urlData.content && (
            <button
              onClick={handleCopyContent}
              className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors rounded"
              title={copyStatus === 'copied' ? 'Copied!' : 'Copy content'}
              disabled={copyStatus === 'copying'}
            >
              {copyStatus === 'copied' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {contentToShow && (
        <div className="space-y-3">
          <div className={`text-sm text-slate-200 leading-relaxed ${isExpanded ? '' : 'line-clamp-4'}`}>
            <div className="whitespace-pre-wrap">
              {contentToShow}
            </div>
          </div>

          {/* Expand/Collapse button */}
          {hasMoreContent && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-sky-400 hover:text-sky-300 transition-colors font-medium"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {/* Metadata */}
      {urlData.extraction_meta && (
        <div className="mt-3 pt-3 border-t border-slate-600 text-xs text-slate-400 space-y-1">
          <div className="flex items-center justify-between">
            <span>
              Extracted: {new Date(urlData.processed_at).toLocaleString()}
            </span>
            {urlData.extraction_meta.word_count && (
              <span>
                {urlData.extraction_meta.word_count.toLocaleString()} words
              </span>
            )}
          </div>
          
          {urlData.extraction_meta.content_length && (
            <div className="text-xs text-slate-500">
              Size: {(urlData.extraction_meta.content_length / 1024).toFixed(1)} KB
              {urlData.extraction_meta.content_type && (
                <span className="ml-2">• {urlData.extraction_meta.content_type.split(';')[0]}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};