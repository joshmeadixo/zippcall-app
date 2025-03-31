'use client';

import React, { useState } from 'react';

export default function CSVImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
    successCount?: number;
    errorCount?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV file first');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('csvFile', file);

      // Get admin auth token from environment variable
      const adminToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';
      
      if (!adminToken) {
        throw new Error('Admin token is not configured. Please check your .env.local file.');
      }
      
      const response = await fetch('/api/admin/pricing/csv-import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: data.success,
          message: data.message,
          count: data.count,
          successCount: data.successCount,
          errorCount: data.errorCount
        });
      } else {
        setError(data.error || 'Failed to import pricing data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow mb-6 p-6 border border-gray-200">
      <h2 className="text-xl font-semibold mb-4">Import Pricing from CSV</h2>
      
      <p className="text-gray-600 mb-4">
        Upload a CSV file with Twilio pricing data. The file should include columns for country name, 
        country code, and price. All prices should be in USD.
      </p>
      
      <div className="mb-4">
        <h3 className="font-medium mb-2">Instructions:</h3>
        <ol className="list-decimal ml-5 text-gray-600">
          <li>Download the International Termination Rate Sheet CSV from the Twilio Console</li>
          <li>Ensure the CSV has columns for country name, country code, and price</li>
          <li>Upload the file below</li>
        </ol>
      </div>
      
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <label className="inline-block">
          <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded cursor-pointer hover:bg-blue-200 transition flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            Select CSV File
          </span>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
        
        {file && (
          <span className="text-sm text-gray-600">
            Selected file: <span className="font-medium">{file.name}</span>
          </span>
        )}
        
        <button
          onClick={handleUpload}
          disabled={!file || isLoading}
          className={`px-4 py-2 rounded ${
            !file || isLoading 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } transition flex items-center gap-2`}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            'Upload and Import'
          )}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {result && (
        <div className={`${
          result.success ? 'bg-green-50 border-green-500' : 'bg-yellow-50 border-yellow-500'
        } border-l-4 p-4`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {result.success ? (
                <svg className="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 9a1 1 0 01-1-1v-4a1 1 0 112 0v4a1 1 0 01-1 1z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className={`text-sm ${result.success ? 'text-green-700' : 'text-yellow-700'}`}>{result.message}</p>
              {result.count !== undefined && (
                <p className={`text-sm ${result.success ? 'text-green-700' : 'text-yellow-700'}`}>
                  Total countries: {result.count}
                  {result.successCount !== undefined && ` (Success: ${result.successCount}`}
                  {result.errorCount !== undefined && `, Errors: ${result.errorCount})`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 