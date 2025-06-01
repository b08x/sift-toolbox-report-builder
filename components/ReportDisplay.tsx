
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GroundingChunk } from '../types';

interface ReportDisplayProps {
  reportContent: string;
  groundingSources?: GroundingChunk[];
}

export const ReportDisplay: React.FC<ReportDisplayProps> = ({ reportContent, groundingSources }) => {
  const handleCopyReport = () => {
    navigator.clipboard.writeText(reportContent)
      .then(() => alert('Report copied to clipboard!'))
      .catch(err => console.error('Failed to copy report: ', err));
  };

  return (
    <div className="mt-8 p-6 bg-slate-800 border border-slate-700 rounded-xl shadow-inner">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-sky-400">Generated Report</h2>
        <button
          onClick={handleCopyReport}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md transition duration-150 ease-in-out"
        >
          Copy Report
        </button>
      </div>
      
      <div className="prose prose-sm sm:prose-base max-w-none markdown-content bg-slate-700 text-slate-200 p-4 rounded-md overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportContent}</ReactMarkdown>
      </div>

      {groundingSources && groundingSources.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-700">
          <h3 className="text-lg font-semibold text-sky-400 mb-2">Grounding Sources (from Google Search):</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {groundingSources.map((source, index) => (
              source.web && (
                <li key={index} className="text-slate-300">
                  <a 
                    href={source.web.uri} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    title={source.web.title || source.web.uri}
                    className="text-indigo-400 hover:text-indigo-300 hover:underline"
                  >
                    {source.web.title || source.web.uri}
                  </a>
                </li>
              )
            ))}
          </ul>
           <p className="text-xs text-slate-500 mt-2">Note: These sources were potentially used by the AI to inform its response.</p>
        </div>
      )}
    </div>
  );
};
