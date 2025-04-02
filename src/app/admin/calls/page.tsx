import React from 'react';
import { getCallRecords, AdminCallRecord, getTotalCallDuration } from './actions';
import { format } from 'date-fns';
import TotalCallDurationWidget from '@/components/admin/TotalCallDurationWidget';
import MobileCardView from '@/components/admin/MobileCardView';

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

export default async function CallsPage() {
  let callRecords: AdminCallRecord[] = [];
  let error: string | null = null;
  
  try {
    [callRecords] = await Promise.all([
      getCallRecords(),
      getTotalCallDuration()
    ]);
  } catch (err) {
    console.error("Failed to fetch call data:", err);
    error = 'Failed to load call data. Please try again later.';
  }

  // Generate mobile card items from call records
  const mobileCardItems = callRecords.map(call => ({
    id: call.id,
    fields: [
      { label: 'Phone Number', value: call.phoneNumber },
      { label: 'Direction', value: call.direction },
      { label: 'Status', value: call.status },
      { label: 'Timestamp', value: format(new Date(call.timestamp), 'yyyy-MM-dd HH:mm') },
      { label: 'Duration', value: formatDuration(call.duration) },
      { label: 'Cost', value: call.cost !== undefined ? `$${call.cost.toFixed(2)}` : 'N/A' },
      { label: 'User ID', value: <span className="text-xs">{call.userId}</span> }
    ]
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Call Records</h1>
      
      <div className="mb-6">
        <TotalCallDurationWidget />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {!error && (
        <>
          {/* Desktop version (hidden on small screens) */}
          <div className="hidden md:block bg-white shadow-md rounded-lg overflow-x-auto">
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
                {callRecords.length === 0 && !error ? (
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

          {/* Mobile version (shown only on small screens) */}
          <div className="md:hidden">
            {callRecords.length === 0 && !error ? (
              <div className="bg-white rounded-lg shadow p-4 text-center text-gray-500">
                No call records found.
              </div>
            ) : (
              <MobileCardView items={mobileCardItems} />
            )}
          </div>
        </>
      )}
    </div>
  );
} 