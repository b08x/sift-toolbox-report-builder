
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, ParsedReportSection } from '../types';
import { SIFT_ICON } from '../constants'; 

interface ChatMessageItemProps {
  message: ChatMessage;
}

// Parser for SIFT Full Check report
const parseReportIntoSections = (markdownText: string): ParsedReportSection[] => {
  const sections: ParsedReportSection[] = [];
  let remainingText = markdownText;

  // 1. Extract Preamble (Generated date, AI-Generated warning)
  const preambleRegex = /^(Generated .*?\nAI-Generated: .*?\n)/s;
  const preambleMatch = remainingText.match(preambleRegex);
  if (preambleMatch) {
    sections.push({ 
      title: "Report Information", 
      rawTitle: "Report Information", 
      content: preambleMatch[0].trim(), 
      level: 0 
    });
    remainingText = remainingText.substring(preambleMatch[0].length).trim();
  }

  const sectionSplitRegex = /(?=^###? .*$)/gm;
  
  const parts = remainingText.split(sectionSplitRegex).filter(part => part.trim() !== '');

  for (const part of parts) {
    const headerMatch = part.match(/^(##\s+(.*?)|###\s+(.*?)):?\s*$/m);
    
    if (headerMatch) {
      const rawTitleLine = headerMatch[0].trim();
      const isH2 = rawTitleLine.startsWith('## '); // Check for space after ##
      let title = (isH2 ? headerMatch[2] : headerMatch[3]) || "Untitled Section";
      title = title.trim().replace(/:$/, '').trim();

      const content = part.substring(rawTitleLine.length).trim();
      
      sections.push({
        title: title,
        rawTitle: rawTitleLine,
        content: content,
        level: isH2 ? 2 : 3,
      });
    } else if (part.trim() && sections.length > 0) {
      sections[sections.length - 1].content += `\n\n${part.trim()}`;
    } else if (part.trim()) {
         sections.push({ title: "Miscellaneous", rawTitle: "Miscellaneous", content: part.trim(), level: 0 });
    }
  }
  return sections.filter(s => s.content.trim() !== '' || s.title === "Report Information");
};

const downloadMarkdown = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};


export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const { sender, text, timestamp, isLoading, isError, groundingSources, imagePreviewUrl, modelId, isInitialSIFTReport, originalQueryReportType } = message;
  const isUser = sender === 'user';

  const handleCopyText = (contentToCopy: string) => {
    navigator.clipboard.writeText(contentToCopy)
      .then(() => alert('Message content copied to clipboard!'))
      .catch(err => console.error('Failed to copy message: ', err));
  };

  const handleExportReport = () => {
    if (!isInitialSIFTReport || !originalQueryReportType || !text) return;

    const reportDate = new Date(timestamp);
    const displayDate = reportDate.toLocaleString();
    const filenameDate = reportDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const reportTypeSanitized = originalQueryReportType.replace(/\s+/g, '_');
    const filename = `SIFT_Report_${reportTypeSanitized}_${filenameDate}.md`;

    let groundingSourcesText = '**Grounding Sources:** N/A';
    if (groundingSources && groundingSources.length > 0) {
        const sourcesList = groundingSources
            .filter(s => s.web && s.web.uri)
            .map(s => `  - [${s.web?.title || s.web?.uri}](${s.web?.uri})`)
            .join('\n');
        if (sourcesList) {
            groundingSourcesText = `**Grounding Sources:**\n${sourcesList}`;
        }
    }
    
    const metadataHeader = `\
# SIFT Report Export

**Generated:** ${displayDate}
**Report Type:** ${originalQueryReportType}
**Model Used:** ${modelId || 'N/A'}
${groundingSourcesText}
---

`;
    const fullMarkdownContent = metadataHeader + text;

    downloadMarkdown(fullMarkdownContent, filename);
  };


  const renderContent = () => {
    if (isInitialSIFTReport && !isError && !isLoading) {
      const parsedSections = parseReportIntoSections(text);
      if (parsedSections.length > 0) {
        return (
          <div className="space-y-4">
            {parsedSections.map((section, index) => (
              <div key={index} className="bg-slate-600/50 p-3 rounded-lg shadow">
                <h3 className={`text-base font-semibold mb-2 ${section.level === 2 ? 'text-sky-300' : 'text-teal-300'}`}>
                  {section.title !== "Report Information" && section.level > 0 && (section.rawTitle.match(/^(##\s*\d+\.\s*|###\s*)/)?.[0] || "")}
                  {section.title}
                </h3>
                <div className="markdown-content prose-sm sm:prose-base max-w-none text-slate-200">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        );
      }
    }
    // Default rendering for user messages, non-full-check AI messages, errors, or if parsing fails
    if (text.trim() || isLoading || (isUser && imagePreviewUrl && !text.trim())) { // Ensure image-only user messages are rendered
      return (
        <div className="markdown-content prose-sm sm:prose-base max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      );
    }
     // Fallback for empty user message without image (should be rare)
    return isUser && !imagePreviewUrl ? <p className="text-sm italic text-indigo-300">(Empty message)</p> : null;
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group mb-2`}>
      <div
        className={`max-w-full w-full px-4 py-3 rounded-xl shadow ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-none ml-8 sm:ml-12' 
            : 'bg-slate-700 text-slate-200 rounded-bl-none mr-8 sm:mr-12'
        } ${
          isError ? 'border border-red-500 bg-red-700/30' : ''
        }`}
      >
        {!isUser && (
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <span className="text-lg mr-2">{SIFT_ICON}</span>
              <span className="font-semibold text-sky-400 text-sm">SIFT Assistant</span>
            </div>
            {modelId && <span className="text-xs text-slate-500 ml-2">({modelId.split('/').pop()?.split(':').shift()})</span>}
          </div>
        )}
        {isUser && imagePreviewUrl && (
            <div className="mb-2">
                <img src={imagePreviewUrl} alt="User upload" className="max-h-48 max-w-full rounded-md border border-slate-500" />
                 {/* Display text only if it exists alongside an image */}
                {text.trim() && <p className="mt-1 text-sm">{/* User text is rendered by renderContent */}</p>}
            </div>
        )}
        {isUser && <p className="font-semibold mb-1 text-sm text-indigo-200">You</p>}
        
        {renderContent()}

        {isLoading && (
          <div className="flex items-center mt-2">
            <svg className="animate-spin h-4 w-4 mr-2 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-xs text-slate-400">SIFTing...</span>
          </div>
        )}
        {isError && !isLoading && (
            <p className="text-xs text-red-400 mt-1">Failed to generate response.</p>
        )}

        {groundingSources && groundingSources.length > 0 && !isLoading && !isError && (
          <div className={`mt-3 pt-2 border-t ${isUser ? 'border-indigo-500' : 'border-slate-600'}`}>
            <h4 className={`text-xs font-semibold mb-1 ${isUser ? 'text-indigo-200' : 'text-sky-500'}`}>Grounding Sources:</h4>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              {groundingSources.map((source, index) => (
                source.web && (
                  <li key={index} className={isUser ? "text-indigo-200" : "text-slate-400"}>
                    <a 
                      href={source.web.uri} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      title={source.web.title || source.web.uri}
                      className={`${isUser ? "text-indigo-300 hover:text-indigo-100" : "text-sky-400 hover:text-sky-300"} hover:underline`}
                    >
                      {source.web.title || source.web.uri}
                    </a>
                  </li>
                )
              ))}
            </ul>
          </div>
        )}

        {!isUser && isInitialSIFTReport && !isLoading && !isError && text.trim() && (
          <div className="mt-3 pt-3 border-t border-slate-600">
            <button
              onClick={handleExportReport}
              className="inline-flex items-center px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-700 focus:ring-emerald-500 transition-colors"
              aria-label="Export SIFT report as Markdown"
              title="Export SIFT report as Markdown"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export Report
            </button>
          </div>
        )}
        
        <div className="flex justify-between items-center mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <p className={`text-xs ${isUser ? 'text-indigo-300' : 'text-slate-500'}`}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            {!isLoading && text.trim() && (
                 <button
                    onClick={() => handleCopyText(text)}
                    title="Copy message"
                    className={`p-1 rounded ${isUser ? 'text-indigo-300 hover:bg-indigo-500' : 'text-slate-400 hover:bg-slate-600'}`}
                    aria-label="Copy message text"
                >
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 4.625-2.25-2.25m0 0L15.75 12m2.25 2.25L15.75 12M9 11.25h6M9 13.5h3.75m-3.75 2.25h1.5m1.5 0h1.5" />
                    </svg>
                </button>
            )}
        </div>
      </div>
    </div>
  );
};
