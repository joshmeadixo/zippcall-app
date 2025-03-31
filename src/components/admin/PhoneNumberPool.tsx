import React, { useState, useEffect } from 'react';

interface PhoneNumber {
  phoneNumber: string;
  isActive: boolean;
}

export default function PhoneNumberPool() {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchPhoneNumbers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/twilio-numbers');
      
      if (!response.ok) {
        throw new Error(`Error fetching phone numbers: ${response.status}`);
      }

      const data = await response.json();
      
      // Convert to our format with isActive flag
      const formattedNumbers = data.phoneNumbers.map((number: string) => ({
        phoneNumber: number,
        isActive: true
      }));

      setPhoneNumbers(formattedNumbers);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch phone numbers:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch phone numbers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPhoneNumbers();
  }, []);

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Phone Number Pool</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {lastRefreshed 
              ? `Last updated: ${lastRefreshed.toLocaleTimeString()}` 
              : 'Not yet refreshed'}
          </span>
          <button
            onClick={fetchPhoneNumbers}
            disabled={isLoading}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                      transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed text-sm"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-600 rounded-md">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex justify-between text-sm text-gray-500">
            <span>Total active numbers: {phoneNumbers.length}</span>
            <span>All numbers will be used randomly for outgoing calls</span>
          </div>

          {phoneNumbers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No phone numbers found. Add numbers in your Twilio account.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {phoneNumbers.map((number) => (
                <div 
                  key={number.phoneNumber}
                  className={`p-3 border rounded-md flex items-center justify-between
                             ${number.isActive ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50'}`}
                >
                  <div className="font-mono">{number.phoneNumber}</div>
                  <div className={`h-2 w-2 rounded-full ${number.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 