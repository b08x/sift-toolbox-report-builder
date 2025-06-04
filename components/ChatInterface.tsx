
import React, { useRef, useEffect, forwardRef } from 'react';
import { ChatMessage } from '../types';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatInputArea } from './ChatInputArea';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (messageText: string, command?: 'another round' | 'read the room') => void;
  isLoading: boolean;
  onStopGeneration?: () => void;
  onRestartGeneration?: () => void; // New prop for restarting
  canRestart?: boolean; // New prop to enable/disable restart button
}

export const ChatInterface = forwardRef<HTMLDivElement, ChatInterfaceProps>(({ messages, onSendMessage, isLoading, onStopGeneration, onRestartGeneration, canRestart }, ref) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-slate-800 shadow-2xl rounded-xl overflow-hidden">
      {/* Chat Messages Area */}
      <div ref={ref} className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700">
        {messages.map((msg) => (
          <ChatMessageItem key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} /> {/* For auto-scrolling */}
      </div>

      {/* Chat Input Area */}
      <div className="shrink-0 p-3 sm:p-4 border-t border-slate-700 bg-slate-800">
        <ChatInputArea 
            onSendMessage={onSendMessage}
            isLoading={isLoading}
            onStopGeneration={onStopGeneration}
            onRestartGeneration={onRestartGeneration}
            canRestart={canRestart}
        />
      </div>
    </div>
  );
});
