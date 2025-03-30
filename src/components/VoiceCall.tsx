import React, { useState, FormEvent, useEffect } from 'react';
import { useTwilioDevice } from '@/hooks/useTwilioDevice';
import { PhoneIcon, PhoneXMarkIcon, MicrophoneIcon } from '@heroicons/react/24/solid';
import { ArrowUpRightIcon, PhoneArrowUpRightIcon, ClockIcon } from '@heroicons/react/24/outline';
import DialPad from './DialPad';
import CallTimer from './CallTimer';
import CallControls from './CallControls';
import AudioVisualizer from './AudioVisualizer';
import CallHistory, { CallHistoryEntry } from './CallHistory';
import PhoneInputWithFlag from './phone/PhoneInput';

interface VoiceCallProps {
  userId: string;
  title?: string;
  hideHistory?: boolean;
  onHistoryUpdate?: (history: CallHistoryEntry[]) => void;
}

export default function VoiceCall({ 
  userId, 
  title = "ZippCall", 
  hideHistory = false,
  onHistoryUpdate 
}: VoiceCallProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('checking');
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [showDialpad, setShowDialpad] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);

  const {
    isReady,
    isConnecting,
    isConnected,
    isAccepted,
    error,
    makeCall,
    hangupCall,
    answerCall,
    rejectCall,
    call
  } = useTwilioDevice({ userId });

  // Check microphone permissions
  useEffect(() => {
    const checkMicrophonePermission = async () => {
      try {
        // Check if the browser supports the permissions API
        if (navigator.permissions && navigator.permissions.query) {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setMicPermission(permissionStatus.state as 'granted' | 'denied' | 'prompt');
          
          // Listen for permission changes
          permissionStatus.onchange = () => {
            setMicPermission(permissionStatus.state as 'granted' | 'denied' | 'prompt');
          };
        } else {
          // Fallback for browsers that don't support the permissions API
          try {
            // Try to access the microphone to see if we have permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            setMicPermission('granted');
          } catch (err) {
            console.error('Error accessing microphone:', err);
            setMicPermission('denied');
          }
        }
      } catch (err) {
        console.error('Error checking microphone permission:', err);
        setMicPermission('denied');
      }
    };
    
    checkMicrophonePermission();
    
    // Set tiered timeouts to check permissions after initial load
    // This helps catch when user grants permission in the browser dialog
    // Some browsers have a delay between when permission is granted and when it's reflected in the API
    const permissionCheckTimers = [
      setTimeout(() => checkMicrophonePermission(), 500),  // Quick first check
      setTimeout(() => checkMicrophonePermission(), 1500), // Second check after browser dialog might close
      setTimeout(() => checkMicrophonePermission(), 3000)  // Final check for slow browsers
    ];
    
    return () => {
      permissionCheckTimers.forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Check for incoming calls
  useEffect(() => {
    if (call && !isConnected && !isConnecting && !isIncomingCall) {
      setIsIncomingCall(true);
    }
  }, [call, isConnected, isConnecting, isIncomingCall]);

  // Update call start time when call is accepted, not just connected
  useEffect(() => {
    if (isAccepted && !callStartTime) {
      setCallStartTime(Date.now());
    } else if (!isConnected && callStartTime) {
      // Call ended, save to history
      const newCall: CallHistoryEntry = {
        id: Date.now().toString(),
        phoneNumber: phoneNumber || 'Unknown',
        timestamp: callStartTime,
        duration: Math.floor((Date.now() - callStartTime) / 1000),
        direction: isIncomingCall ? 'incoming' : 'outgoing',
        status: 'answered'
      };
      
      const updatedHistory = [newCall, ...callHistory].slice(0, 50); // Keep last 50 calls
      setCallHistory(updatedHistory);
      setCallStartTime(null);
      
      // Notify parent component of history update if callback provided
      if (onHistoryUpdate) {
        onHistoryUpdate(updatedHistory);
      }
    }
  }, [isAccepted, isConnected, callStartTime, phoneNumber, isIncomingCall, callHistory, onHistoryUpdate]);

  // Handle call controls
  const handleToggleMute = (isMuted: boolean) => {
    if (!call) return;
    
    try {
      if (isMuted) {
        call.mute(true);
      } else {
        call.mute(false);
      }
    } catch (err) {
      console.error('Error toggling mute:', err);
    }
  };

  const handleCallSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;
    await startCall(phoneNumber);
  };

  const startCall = async (number: string) => {
    // Phone number is already in E.164 format from the PhoneInputWithFlag component
    const formattedNumber = number.trim();
    
    setPhoneNumber(formattedNumber);
    
    // First, ensure we have microphone access before making the call
    if (micPermission !== 'granted') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setMicPermission('granted');
      } catch (err) {
        console.error('Failed to get microphone access:', err);
        setMicPermission('denied');
        return;
      }
    }
    
    await makeCall(formattedNumber);
  };

  const handleDigitPressed = (digit: string) => {
    if (isConnected && call) {
      // Send DTMF tone during call
      call.sendDigits(digit);
    } else {
      // When using the dialer, simply append the digit
      // This ensures we don't interfere with the country code handling 
      // which is managed by the PhoneInputWithFlag component
      setPhoneNumber(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    const phoneInput = document.getElementById('phone-input') as HTMLInputElement;
    if (phoneInput) {
      const start = phoneInput.selectionStart || phoneInput.value.length;
      const end = phoneInput.selectionEnd || phoneInput.value.length;
      const value = phoneInput.value;
      
      if (start === end) {
        // No selection, delete character before cursor
        if (start > 0) {
          const newValue = value.substring(0, start - 1) + value.substring(end);
          setPhoneNumber(newValue);
          
          // Set cursor position
          setTimeout(() => {
            phoneInput.focus();
            phoneInput.setSelectionRange(start - 1, start - 1);
          }, 0);
        }
      } else {
        // Delete selected text
        const newValue = value.substring(0, start) + value.substring(end);
        setPhoneNumber(newValue);
        
        // Set cursor position
        setTimeout(() => {
          phoneInput.focus();
          phoneInput.setSelectionRange(start, start);
        }, 0);
      }
    } else {
      // Fallback to removing last character
      setPhoneNumber(prev => prev.slice(0, -1));
    }
  };

  const handleClearNumber = () => {
    setPhoneNumber('');
  };

  const handleHistoryCallClick = (number: string) => {
    if (!isConnected && !isConnecting) {
      setPhoneNumber(number);
      startCall(number);
      setShowHistory(false);
    }
  };

  // Add function to manually check permissions
  const recheckMicrophonePermission = async () => {
    try {
      // Direct microphone access attempt - this will trigger the browser permission dialog if needed
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicPermission('granted');
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setMicPermission('denied');
    }
  };

  // Add a periodic check for microphone permissions when in prompt state
  useEffect(() => {
    if (micPermission !== 'prompt') return;
    
    // Set up an interval to check permissions every few seconds
    // This helps when a user grants permission in another tab or through browser settings
    const periodicPermissionCheck = setInterval(() => {
      recheckMicrophonePermission();
    }, 5000); // Check every 5 seconds
    
    return () => {
      clearInterval(periodicPermissionCheck);
    };
  }, [micPermission]);

  // Add an event listener for visibility changes to recheck permissions when user returns to the app
  useEffect(() => {
    // Only add this listener if permission is still in "prompt" state
    if (micPermission !== 'prompt') return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User has returned to the tab - recheck permissions
        recheckMicrophonePermission();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Clean up
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [micPermission]);

  // Render microphone permission status/prompt if needed
  if (micPermission === 'denied') {
    return (
      <div className="bg-white rounded-lg p-6 shadow-md">
        <h3 className="text-xl font-semibold mb-4">Microphone Access Required</h3>
        <div className="bg-red-100 text-red-700 p-4 rounded-md mb-4">
          <p className="flex items-center">
            <MicrophoneIcon className="h-5 w-5 mr-2" />
            Microphone access was denied
          </p>
          <p className="mt-2 text-sm">
            To make and receive calls, please allow microphone access in your browser settings and refresh the page.
          </p>
        </div>
        <button
          onClick={async () => {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              stream.getTracks().forEach(track => track.stop());
              setMicPermission('granted');
            } catch (err) {
              console.error('Failed to get microphone access:', err);
            }
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2 w-full"
        >
          Request Microphone Access
        </button>
      </div>
    );
  }
  
  if (micPermission === 'checking') {
    return (
      <div className="bg-white rounded-lg p-6 shadow-md">
        <h3 className="text-xl font-semibold mb-4">Checking Microphone Access</h3>
        <div className="flex items-center justify-center p-6">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 rounded-full border-t-transparent mr-2"></div>
          <p>Checking microphone permission...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-blue-500 text-white p-4 flex justify-between items-center">
        <h3 className="text-xl font-semibold">{title}</h3>
        {!hideHistory && (
          <div className="flex space-x-2">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-full ${showHistory ? 'bg-blue-600' : 'hover:bg-blue-600'}`}
              aria-label="Toggle call history"
            >
              <ClockIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
      
      {/* Main content */}
      <div className="p-6">
        {micPermission === 'prompt' && (
          <div className="bg-yellow-100 text-yellow-700 p-4 rounded-md mb-5 border-l-4 border-yellow-400">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <MicrophoneIcon className="h-6 w-6 mr-3 text-yellow-600" />
                <div>
                  <p className="font-medium">Microphone access is required</p>
                  <p className="text-sm mt-1">
                    Please click the button to grant microphone access. Your browser may show a permission dialog.
                  </p>
                </div>
              </div>
              <button 
                onClick={recheckMicrophonePermission}
                className="ml-4 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md text-sm font-medium"
              >
                Grant Access
              </button>
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">
            Error: {error}
          </div>
        )}

        {/* Call history view */}
        {showHistory && !isConnected && !isConnecting && !isIncomingCall ? (
          <div>
            <h4 className="text-lg font-medium mb-3">Recent Calls</h4>
            <CallHistory 
              calls={callHistory} 
              onCallClick={handleHistoryCallClick} 
            />
            <button
              onClick={() => setShowHistory(false)}
              className="mt-4 w-full p-2 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
            >
              Back to Dialpad
            </button>
          </div>
        ) : (
          <>
            {!isReady ? (
              <div className="flex items-center justify-center p-6">
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 rounded-full border-t-transparent mr-2"></div>
                <p>Initializing phone...</p>
              </div>
            ) : isConnected ? (
              // Active call view
              <div className="text-center">
                <div className="mb-4">
                  <p className="text-lg font-medium mb-1">
                    Call in progress
                  </p>
                  <p className="text-gray-500 text-sm">
                    {phoneNumber || 'Unknown number'}
                  </p>
                </div>
                
                <AudioVisualizer isActive={isConnected} />
                
                <div className="my-4">
                  <CallTimer startTime={callStartTime} isActive={isAccepted} />
                </div>
                
                <CallControls 
                  onHangup={hangupCall}
                  onToggleMute={handleToggleMute}
                />
                
                {/* Dialpad for active call (for IVR navigation) */}
                <div className="mt-4">
                  <button
                    onClick={() => setShowDialpad(!showDialpad)}
                    className="text-blue-500 text-sm mb-2"
                  >
                    {showDialpad ? 'Hide Dialpad' : 'Show Dialpad'}
                  </button>
                  
                  {showDialpad && (
                    <div className="mt-2">
                      <DialPad 
                        onDigitPressed={handleDigitPressed}
                        onBackspace={handleBackspace}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : isIncomingCall ? (
              // Incoming call view
              <div className="text-center">
                <div className="animate-pulse mb-4">
                  <ArrowUpRightIcon className="h-12 w-12 mx-auto text-green-500 mb-2" />
                  <p className="text-lg font-medium">Incoming call</p>
                  <p className="text-gray-500">{call?.parameters.From || 'Unknown'}</p>
                </div>
                
                <div className="flex justify-center space-x-6 mt-6">
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
                      
                      // Add to history as rejected call
                      const newCall: CallHistoryEntry = {
                        id: Date.now().toString(),
                        phoneNumber: call?.parameters.From || 'Unknown',
                        timestamp: Date.now(),
                        duration: 0,
                        direction: 'incoming',
                        status: 'rejected'
                      };
                      
                      const updatedHistory = [newCall, ...callHistory].slice(0, 50);
                      setCallHistory(updatedHistory);
                      
                      // Notify parent component if callback provided
                      if (onHistoryUpdate) {
                        onHistoryUpdate(updatedHistory);
                      }
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4 flex items-center justify-center"
                    aria-label="Reject call"
                  >
                    <PhoneXMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
            ) : isConnecting ? (
              // Connecting call view
              <div className="text-center">
                <div className="mb-4">
                  <p className="text-lg font-medium mb-1">Calling...</p>
                  <p className="text-gray-500">{phoneNumber}</p>
                </div>
                
                <div className="flex items-center justify-center mb-4">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                </div>
                
                <button
                  onClick={hangupCall}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4 flex items-center justify-center mx-auto"
                >
                  <PhoneXMarkIcon className="h-6 w-6" />
                </button>
              </div>
            ) : (
              // Idle phone view with dial pad
              <div>
                <div className="mb-6">
                  <PhoneInputWithFlag
                    value={phoneNumber}
                    onChange={setPhoneNumber}
                    placeholder="+1 (234) 567-8900"
                    onFocus={() => {}}
                  />
                </div>
                
                <DialPad 
                  onDigitPressed={handleDigitPressed}
                  onBackspace={handleBackspace}
                />
                
                <div className="mt-4 flex justify-center space-x-4">
                  <button
                    onClick={handleClearNumber}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm font-medium"
                  >
                    Clear Number
                  </button>
                </div>
                
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={handleCallSubmit}
                    disabled={!phoneNumber.trim() || !isReady}
                    className={`rounded-full p-5 flex items-center justify-center
                      ${!phoneNumber.trim() || !isReady 
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    aria-label="Make call"
                  >
                    <PhoneArrowUpRightIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      <div className="px-4 py-2 text-xs text-gray-500 border-t">
        <p>Status: {isReady ? 'Ready' : 'Initializing'} | Mic: {micPermission} {isConnected && (isAccepted ? '| Call: Connected' : '| Call: Connecting...')}</p>
      </div>
    </div>
  );
} 