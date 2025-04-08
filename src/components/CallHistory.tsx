import React from 'react';
import { PhoneIcon, ArrowUpRightIcon, ArrowDownLeftIcon, ClockIcon, CurrencyDollarIcon, TrashIcon } from '@heroicons/react/24/outline';

export interface CallHistoryEntry {
  id: string;
  phoneNumber: string;
  timestamp: number;
  duration: number; // in seconds
  direction: 'incoming' | 'outgoing';
  status: 'answered' | 'missed' | 'rejected';
  cost?: number; // call cost in USD
}

interface CallHistoryProps {
  calls: CallHistoryEntry[];
  onCallClick: (phoneNumber: string) => void;
  onDeleteClick?: (callId: string) => void;
}

const CallHistory: React.FC<CallHistoryProps> = ({ calls, onCallClick, onDeleteClick }) => {
  // Format timestamp to readable date/time
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isToday) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (isYesterday) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
        ` ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  };
  
  // Format call duration
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return `${hours}h ${remainingMinutes}m`;
  };
  
  // Handle call button click
  const handleCallClick = (e: React.MouseEvent, phoneNumber: string) => {
    e.stopPropagation();
    onCallClick(phoneNumber);
  };
  
  // Handle delete button click
  const handleDeleteClick = (e: React.MouseEvent, callId: string) => {
    e.stopPropagation();
    if (onDeleteClick) {
      onDeleteClick(callId);
    }
  };

  if (!calls.length) {
    return (
      <div className="text-center py-4 text-gray-500">
        <PhoneIcon className="h-6 w-6 mx-auto mb-1 opacity-50" />
        <p>No recent calls</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto max-h-64">
      <ul className="divide-y divide-gray-100">
        {calls.map((call) => (
          <li 
            key={call.id}
            className="py-2 px-2 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              {/* Direction icon */}
              <div className={`p-1 rounded-full mr-2 
                ${call.direction === 'incoming' 
                  ? call.status === 'answered' 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-red-100 text-red-600'
                  : 'bg-blue-100 text-blue-600'
                }`}
              >
                {call.direction === 'incoming' ? (
                  <ArrowDownLeftIcon className="h-3.5 w-3.5" />
                ) : (
                  <ArrowUpRightIcon className="h-3.5 w-3.5" />
                )}
              </div>
              
              {/* Call info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="truncate">
                    <span className="font-medium text-sm">{call.phoneNumber}</span>
                    <span className={`ml-2 text-xs ${
                      call.status === 'missed' ? 'text-red-500' : 'text-gray-500'
                    }`}>
                      {call.status === 'missed' 
                        ? 'No Answer'
                        : call.status === 'rejected'
                          ? 'Rejected'
                          : `${call.direction === 'incoming' ? 'In' : 'Out'}`
                      }
                    </span>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex shrink-0 space-x-1">
                    <button
                      onClick={(e) => handleCallClick(e, call.phoneNumber)}
                      className="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                      title="Call this number"
                    >
                      <PhoneIcon className="h-3 w-3" />
                    </button>
                    
                    {onDeleteClick && (
                      <button
                        onClick={(e) => handleDeleteClick(e, call.id)}
                        className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                        title="Delete this call record"
                      >
                        <TrashIcon className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Second row with time and duration info */}
                <div className="flex justify-between items-center mt-0.5 text-xs text-gray-500">
                  <div className="flex items-center">
                    <ClockIcon className="h-2.5 w-2.5 mr-1" />
                    <span>{formatTimestamp(call.timestamp)}</span>
                  </div>
                  
                  {call.status === 'answered' && (
                    <div className="flex items-center space-x-2">
                      <span>{formatDuration(call.duration)}</span>
                      {call.cost !== undefined && (
                        <span className="flex items-center">
                          <CurrencyDollarIcon className="h-2.5 w-2.5 mr-0.5" />
                          ${call.cost.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CallHistory; 