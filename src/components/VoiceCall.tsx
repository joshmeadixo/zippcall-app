import { useState, FormEvent, useEffect } from 'react';
import { useTwilioDevice } from '@/hooks/useTwilioDevice';
import { PhoneIcon, PhoneXMarkIcon } from '@heroicons/react/24/solid';

interface VoiceCallProps {
  userId: string;
}

export default function VoiceCall({ userId }: VoiceCallProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  
  const {
    isReady,
    isConnecting,
    isConnected,
    error,
    makeCall,
    hangupCall,
    answerCall,
    rejectCall,
    call
  } = useTwilioDevice({ userId });

  // Check for incoming calls
  useEffect(() => {
    if (call && !isConnected && !isConnecting && !isIncomingCall) {
      setIsIncomingCall(true);
    }
  }, [call, isConnected, isConnecting, isIncomingCall]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;
    
    // Format phone number to add + if needed
    let formattedNumber = phoneNumber.trim();
    if (!formattedNumber.startsWith('+')) {
      formattedNumber = `+${formattedNumber}`;
    }
    
    await makeCall(formattedNumber);
  };
  
  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <h3 className="text-xl font-semibold mb-4">Twilio Voice Calling</h3>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">
          Error: {error}
        </div>
      )}

      {!isReady ? (
        <div className="flex items-center justify-center p-6">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 rounded-full border-t-transparent mr-2"></div>
          <p>Initializing phone...</p>
        </div>
      ) : isConnected ? (
        <div className="text-center">
          <div className="mb-4">
            <p className="text-lg font-medium mb-1">
              Call in progress
            </p>
            <p className="text-gray-500 text-sm">
              {phoneNumber || 'Unknown number'}
            </p>
          </div>
          
          <div className="flex justify-center space-x-4">
            <button
              onClick={hangupCall}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4 flex items-center justify-center"
              aria-label="Hang up call"
            >
              <PhoneXMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
      ) : isIncomingCall ? (
        <div className="text-center">
          <p className="text-lg font-medium mb-4">Incoming call...</p>
          
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => {
                answerCall();
                setIsIncomingCall(false);
              }}
              className="bg-green-500 hover:bg-green-600 text-white rounded-full p-4 flex items-center justify-center"
              aria-label="Answer call"
            >
              <PhoneIcon className="h-6 w-6" />
            </button>
            
            <button
              onClick={() => {
                rejectCall();
                setIsIncomingCall(false);
              }}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4 flex items-center justify-center"
              aria-label="Reject call"
            >
              <PhoneXMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
      ) : isConnecting ? (
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 rounded-full border-t-transparent mr-2"></div>
            <p>Connecting call...</p>
          </div>
          
          <button
            onClick={hangupCall}
            className="bg-red-500 hover:bg-red-600 text-white rounded-md px-4 py-2"
          >
            Cancel
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Enter phone number with country code (e.g., +1 for US)</p>
          </div>
          
          <button
            type="submit"
            disabled={!isReady}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2 flex items-center justify-center"
          >
            <PhoneIcon className="h-5 w-5 mr-2" />
            Make Call
          </button>
        </form>
      )}
      
      <div className="mt-4 text-xs text-gray-500">
        <p>Status: {isReady ? 'Ready' : 'Initializing'}</p>
      </div>
    </div>
  );
} 