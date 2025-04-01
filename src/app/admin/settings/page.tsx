'use client';

import React, { useState, useEffect } from 'react';
import { getTwilioPhoneNumbers } from './actions'; // Import the server action
import { format } from 'date-fns'; // Import date formatting function

// Define an interface for the phone number data we expect
interface TwilioPhoneNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  dateCreated: string; // ISO string format from action
}

export default function SettingsPage() {
  const [phoneNumbers, setPhoneNumbers] = useState<TwilioPhoneNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNumbers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log('[Settings Page] Fetching Twilio numbers...');
        const numbers = await getTwilioPhoneNumbers();
        console.log(`[Settings Page] Received ${numbers.length} numbers from action.`);
        setPhoneNumbers(numbers);
      } catch (err) {
        console.error('[Settings Page] Error fetching Twilio numbers:', err);
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
        setError(`Failed to load Twilio phone numbers: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNumbers();
  }, []); // Empty dependency array ensures this runs once on mount

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Settings</h1>

      <div className="bg-white shadow-md rounded-lg mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Twilio Phone Numbers</h2>
        </div>
        <div className="px-6 py-4">
          {isLoading && (
            <div className="text-center py-10">
              <div className="loading loading-spinner loading-lg text-blue-500"></div>
              <p className="mt-2">Loading phone numbers...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {!isLoading && !error && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Friendly Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Added</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SID</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {phoneNumbers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No Twilio phone numbers found in your account.</td>
                    </tr>
                  ) : (
                    phoneNumbers.map((num) => (
                      <tr key={num.sid} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{num.phoneNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{num.friendlyName}</td>
                        {/* Format Date using date-fns */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(num.dateCreated), 'yyyy-MM-dd HH:mm')}
                        </td>
                        <td title={num.sid} className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 truncate" style={{ maxWidth: '150px' }}>{num.sid}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Add other settings sections below if needed */}

    </div>
  );
} 