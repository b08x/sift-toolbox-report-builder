
import React, { useState, KeyboardEvent } from 'react';

interface ChatInputAreaProps {
  onSendMessage: (messageText: string, command?: 'another round' | 'read the room') => void;
  isLoading: boolean;
  onStopGeneration?: () => void; // New prop for stopping
}

export const ChatInputArea: React.FC<ChatInputAreaProps> = ({ onSendMessage, isLoading, onStopGeneration }) => {
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (inputText.trim() && !isLoading) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const handleCommand = (command: 'another round' | 'read the room') => {
    if (!isLoading) {
      onSendMessage(command, command); 
      setInputText(''); 
    }
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !isLoading) { // Don't send if loading
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end space-x-2">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isLoading ? "AI is responding..." : "Type your message or select a command..."}
          className="flex-grow p-3 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 text-slate-100 placeholder-slate-400 resize-none scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-slate-700 disabled:bg-slate-600 disabled:cursor-not-allowed"
          rows={Math.min(3, Math.max(1, inputText.split('\n').length))} 
          disabled={isLoading}
          aria-label="Chat message input"
        />
        <button
          onClick={isLoading ? onStopGeneration : handleSend}
          disabled={isLoading ? false : !inputText.trim()} // Enable stop button when loading, enable send if text exists and not loading
          className={`px-4 py-3 text-white font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-full flex items-center justify-center
            ${isLoading 
              ? 'bg-red-600 hover:bg-red-500 focus:ring-red-500' 
              : 'bg-indigo-600 hover:bg-indigo-500 focus:ring-indigo-500'}`}
          aria-label={isLoading ? "Stop generation" : "Send message"}
        >
          {isLoading ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.949a.75.75 0 00.95.579h1.844a.75.75 0 00.659-.41l1.415-2.452a.75.75 0 00-.24-1.025S4.106 2.29 3.105 2.29zM3.105 2.289L1.691 7.238a.75.75 0 00.95.826h1.844a.75.75 0 00.579-.95L3.654 3.202a.75.75 0 00-1.025-.24S2.29 4.106 2.29 3.105zM14.999 2.525a.75.75 0 00-1.025.24L12.559 6.43a.75.75 0 00.659.41h1.844a.75.75 0 00.95-.579l1.414-4.949a.75.75 0 00-.826-.95L14.999 2.525z" />
              <path d="M16.895 10.532l-2.452-1.415a.75.75 0 00-1.025.24S12.29 10.394 12.29 11.395l1.414 4.949a.75.75 0 00.95.579h1.844a.75.75 0 00.579-.95L15.654 12.082a.75.75 0 00-.24-1.025S16.895 10.532 16.895 10.532zM9.25 12.25a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5z" />
              <path fillRule="evenodd" d="M8.25 5.038a.75.75 0 01.75.712v9.5a.75.75 0 01-.75.75A.75.75 0 017.5 16V5.75a.75.75 0 01.75-.712zM11.75 5.038a.75.75 0 01.75.712v9.5a.75.75 0 01-.75.75a.75.75 0 01-.75-.75V5.75a.75.75 0 01.75-.712z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() => handleCommand('another round')}
          disabled={isLoading} // Disable command buttons while AI is responding
          className="flex-1 px-3 py-2 text-sm bg-sky-600 hover:bg-sky-500 text-sky-100 font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          aria-label="Send 'another round' command"
        >
          Another Round 🔁
        </button>
        <button
          onClick={() => handleCommand('read the room')}
          disabled={isLoading} // Disable command buttons while AI is responding
          className="flex-1 px-3 py-2 text-sm bg-teal-600 hover:bg-teal-500 text-teal-100 font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-teal-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          aria-label="Send 'read the room' command"
        >
          Read the Room 🧐
        </button>
      </div>
    </div>
  );
};
