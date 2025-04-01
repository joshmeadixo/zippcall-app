'use client';

import React, { useState, useEffect } from 'react';
import { getCallRecords, AdminCallRecord } from './actions';
import { format } from 'date-fns';

// Helper to format duration from seconds to HH:MM:SS or MM:SS
const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  
  const totalMinutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  const secStr = String(remainingSeconds).padStart(2, '0');
  const minStr = String(remainingMinutes).padStart(2, '0');

  if (hours > 0) {
    const hourStr = String(hours).padStart(2, '0');
    return `${hourStr}:${minStr}:${secStr}`;
  } else {
    return `${minStr}:${secStr}`;
  }
};

export default function CallsPage() {
  const [callRecords, setCallRecords] = useState<AdminCallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const records = await getCallRecords();
        setCallRecords(records);
      } catch (err) {
        console.error("Failed to fetch call records:", err);
        setError('Failed to load call records. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecords();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Call Records</h1>
      
      {isLoading && (
        <div className="text-center py-10">
          <div className="loading loading-spinner loading-lg text-blue-500"></div>
          <p className="mt-2">Loading calls...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {!isLoading && !error && (
        <div className="bg-white shadow-md rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Direction</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Call ID</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {callRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No call records found.</td>
                </tr>
              ) : (
                callRecords.map((call) => (
                  <tr key={call.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{call.userId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{call.phoneNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{call.direction}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{call.status}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{format(new Date(call.timestamp), 'yyyy-MM-dd HH:mm')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatDuration(call.duration)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{call.cost !== undefined ? `$${call.cost.toFixed(2)}` : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{format(new Date(call.createdAt), 'yyyy-MM-dd HH:mm')}</td>
                    <td title={call.id} className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 truncate" style={{ maxWidth: '100px' }}>{call.id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 