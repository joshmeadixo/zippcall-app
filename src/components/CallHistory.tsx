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
      <div className="text-center py-8 text-gray-500">
        <PhoneIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No recent calls</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto max-h-64">
      <ul className="space-y-2">
        {calls.map((call) => (
          <li 
            key={call.id}
            className="p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <div className={`p-2 rounded-full mr-3 
                ${call.direction === 'incoming' 
                  ? call.status === 'answered' 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-red-100 text-red-600'
                  : 'bg-blue-100 text-blue-600'
                }`}
              >
                {call.direction === 'incoming' ? (
                  <ArrowDownLeftIcon className="h-5 w-5" />
                ) : (
                  <ArrowUpRightIcon className="h-5 w-5" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex justify-between">
                  <p className="font-medium">{call.phoneNumber}</p>
                  <p className="text-xs text-gray-500 flex items-center">
                    <ClockIcon className="h-3 w-3 mr-1" />
                    {formatTimestamp(call.timestamp)}
                  </p>
                </div>
                
                <div className="flex justify-between mt-1">
                  <p className={`text-sm ${
                    call.status === 'missed' ? 'text-red-500' : 'text-gray-500'
                  }`}>
                    {call.status === 'missed' 
                      ? 'Missed Call' 
                      : call.status === 'rejected'
                        ? 'Call Rejected'
                        : `${call.direction === 'incoming' ? 'Incoming' : 'Outgoing'} Call`
                    }
                  </p>
                  
                  {call.status === 'answered' && (
                    <div className="flex items-center space-x-3">
                      <p className="text-xs text-gray-500">
                        {formatDuration(call.duration)}
                      </p>
                      {call.cost !== undefined && (
                        <p className="text-xs text-gray-600 flex items-center">
                          <CurrencyDollarIcon className="h-3 w-3 mr-1" />
                          ${call.cost.toFixed(4)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex justify-end mt-2 space-x-2">
              <button
                onClick={(e) => handleCallClick(e, call.phoneNumber)}
                className="p-1.5 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 transition-colors flex items-center text-xs"
                title="Call this number"
              >
                <PhoneIcon className="h-3.5 w-3.5 mr-1" />
                <span>Call</span>
              </button>
              
              {onDeleteClick && (
                <button
                  onClick={(e) => handleDeleteClick(e, call.id)}
                  className="p-1.5 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors flex items-center text-xs"
                  title="Delete this call record"
                >
                  <TrashIcon className="h-3.5 w-3.5 mr-1" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CallHistory; 