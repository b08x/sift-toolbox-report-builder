
import React from 'react';
import { ReportType } from '../types';

interface UserQueryPanelProps {
  userInputText: string;
  userImagePreviewUrl?: string;
  reportType: ReportType;
}

export const UserQueryPanel: React.FC<UserQueryPanelProps> = ({
  userInputText,
  userImagePreviewUrl,
  reportType,
}) => {
  return (
    <aside className="w-64 md:w-72 bg-slate-800/70 p-4 shadow-lg flex-shrink-0 h-full overflow-y-auto border-r border-slate-700 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700/50">
      <h2 className="text-lg font-semibold text-sky-400 mb-4 sticky top-0 bg-slate-800/80 backdrop-blur-sm py-3 -mt-4 -mx-4 px-4 border-b border-slate-700 z-10">
        Current Query
      </h2>
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-indigo-300 mb-1">Report Type:</h3>
          <p className="text-sm text-slate-200 bg-slate-700 p-2 rounded-md">{reportType}</p>
        </div>

        {userInputText && (
          <div>
            <h3 className="text-sm font-medium text-indigo-300 mb-1">Text Analyzed:</h3>
            <p className="text-sm text-slate-200 bg-slate-700 p-2 rounded-md max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-slate-600">
              {userInputText}
            </p>
          </div>
        )}

        {userImagePreviewUrl && (
          <div>
            <h3 className="text-sm font-medium text-indigo-300 mb-1">Image Analyzed:</h3>
            <img 
              src={userImagePreviewUrl} 
              alt="User uploaded query" 
              className="max-w-full h-auto rounded-md border border-slate-600"
            />
          </div>
        )}
        
        {!userInputText && !userImagePreviewUrl && (
             <p className="text-sm text-slate-400 italic">No text or image was part of this initial query focus.</p>
        )}
      </div>
    </aside>
  );
};
