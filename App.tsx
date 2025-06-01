
import React, { useState, useCallback } from 'react';
import { InputForm } from './components/InputForm';
import { ReportDisplay } from './components/ReportDisplay';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorAlert } from './components/ErrorAlert';
import { generateSiftReport } from './services/geminiService';
import { ReportType, GroundingChunk } from './types';
import { SIFT_ICON } from './constants';

const App: React.FC = () => {
  const [userInputText, setUserInputText] = useState<string>('');
  const [userImageFile, setUserImageFile] = useState<File | null>(null);
  const [reportType, setReportType] = useState<ReportType>(ReportType.FULL_CHECK);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [groundingSources, setGroundingSources] = useState<GroundingChunk[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>(''); 

  React.useEffect(() => {
    // Attempt to read API_KEY from process.env on component mount.
    // This state (apiKey) is used for UI warnings and pre-flight checks in App.tsx.
    // The geminiService.ts will independently and directly use process.env.API_KEY.
    const envApiKey = typeof process !== 'undefined' && process.env && process.env.API_KEY ? process.env.API_KEY : '';
    setApiKey(envApiKey);
  }, []);

  const handleGenerateReport = useCallback(async () => {
    // This pre-flight check uses the apiKey state derived from process.env.API_KEY at mount.
    // It provides immediate UI feedback if the key wasn't found.
    // geminiService.ts will perform its own check against process.env.API_KEY at the time of the call.
    if (!apiKey) {
      setError("Gemini API Key is not available. Please ensure the API_KEY environment variable is set and the application is built/run in an environment where it's accessible.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedReport(null);
    setGroundingSources(undefined);

    let imageBase64: string | null = null;
    let imageMimeType: string | null = null;

    if (userImageFile) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(userImageFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
        });
        imageBase64 = base64.split(',')[1]; 
        imageMimeType = userImageFile.type;
      } catch (err) {
        setError('Failed to process image file.');
        setIsLoading(false);
        return;
      }
    }

    try {
      // Call generateSiftReport without the apiKey argument.
      // The service will now directly use process.env.API_KEY.
      const result = await generateSiftReport(userInputText, imageBase64, imageMimeType, reportType);
      setGeneratedReport(result.reportText);
      setGroundingSources(result.groundingChunks);
    } catch (err: any) {
      console.error("Error generating report:", err);
      setError(err.message || 'An unexpected error occurred while generating the report.');
    } finally {
      setIsLoading(false);
    }
  }, [userInputText, userImageFile, reportType, apiKey]); // apiKey remains in dependency array as it's used for the pre-flight check within this callback.
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-slate-100 p-4 sm:p-6 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-4xl mb-8 text-center">
        <div className="flex items-center justify-center space-x-3 mb-2">
          <span className="text-4xl">{SIFT_ICON}</span>
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-500">
            SIFT Toolbox Report Builder
          </h1>
        </div>
        <p className="text-slate-400 text-lg">
          Analyze claims, images, and artifacts using the SIFT methodology.
        </p>
      </header>

      <main className="w-full max-w-4xl bg-slate-800 shadow-2xl rounded-xl p-6 sm:p-8">
        {!apiKey && ( // This UI warning uses the apiKey state.
           <ErrorAlert message="Warning: Gemini API Key (API_KEY environment variable) might not be set or accessible. The application may not function correctly." />
        )}
        <InputForm
          userInputText={userInputText}
          setUserInputText={setUserInputText}
          userImageFile={userImageFile}
          setUserImageFile={setUserImageFile}
          reportType={reportType}
          setReportType={setReportType}
          onGenerateReport={handleGenerateReport}
          isLoading={isLoading}
        />

        {isLoading && <LoadingSpinner />}
        {error && !isLoading && <ErrorAlert message={error} />}
        
        {generatedReport && !isLoading && (
          <ReportDisplay reportContent={generatedReport} groundingSources={groundingSources} />
        )}
      </main>

      <footer className="w-full max-w-4xl mt-12 text-center text-slate-500 text-sm">
        <p>&copy; {new Date().getFullYear()} SIFT Toolbox Report Builder. Powered by Gemini.</p>
      </footer>
    </div>
  );
};

export default App;
