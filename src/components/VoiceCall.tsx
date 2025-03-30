import React, { useState, FormEvent, useEffect } from 'react';
import { useTwilioDevice } from '@/hooks/useTwilioDevice';
import { PhoneIcon, PhoneXMarkIcon, MicrophoneIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { PhoneArrowUpRightIcon, ClockIcon, GlobeAmericasIcon } from '@heroicons/react/24/outline';
import DialPad from './DialPad';
import CallTimer from './CallTimer';
import CallControls from './CallControls';
import AudioVisualizer from './AudioVisualizer';
import CallHistory, { CallHistoryEntry } from './CallHistory';
import PhoneInputWithFlag from './phone/PhoneInput';
import { validatePhoneNumber } from '@/utils/phoneValidation';

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
  // Define all possible mic permission states
  type MicPermissionState = 'granted' | 'denied' | 'prompt' | 'checking';
  const [micPermission, setMicPermission] = useState<MicPermissionState>('checking');
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [showDialpad, setShowDialpad] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [isPhoneNumberValid, setIsPhoneNumberValid] = useState(false);
  const [validatedE164Number, setValidatedE164Number] = useState<string>('');
  const [countrySelected, setCountrySelected] = useState<boolean>(false);

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

  const handlePhoneValidityChange = (isValid: boolean, formattedNumber?: string) => {
    setIsPhoneNumberValid(isValid);
    if (isValid && formattedNumber) {
      setValidatedE164Number(formattedNumber);
    } else {
      setValidatedE164Number('');
    }
  };

  const handleCountrySelection = () => {
    setCountrySelected(true);
  };

  const handleCallSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Don't allow calls with invalid numbers
    if (!isPhoneNumberValid || !validatedE164Number) {
      // Manual validation as a fallback
      const selectedCountry = document.querySelector('.PhoneInputCountrySelect')?.getAttribute('data-country') || 'US';
      const validation = validatePhoneNumber(phoneNumber, selectedCountry);
      
      if (validation.isValid && validation.e164Number) {
        setValidatedE164Number(validation.e164Number);
        await startCall(validation.e164Number);
      } else {
        console.error('Invalid phone number:', phoneNumber);
        return;
      }
    } else {
      await startCall(validatedE164Number);
    }
  };

  const startCall = async (number: string) => {
    // Phone number is already validated and in E.164 format
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
      // When using the dialer, preserve the country code
      // This will keep the country prefix if the phone input is empty or has just the country code
      if (!phoneNumber || phoneNumber.trim() === '') {
        // If the field is empty, we need to initialize with the selected country's code
        // Get the country select element
        const countrySelect = document.querySelector('.PhoneInputCountrySelect') as HTMLSelectElement;
        
        if (countrySelect) {
          // Get the country code from the select element's value
          const selectedCountryCode = countrySelect.value || 'US';
          
          // Get the country calling code (+1 for US, +44 for GB, etc.)
          // We'll use a simple mapping for common countries
          const callingCodes: Record<string, string> = {
            'US': '1',
            'CA': '1',
            'GB': '44',
            'AU': '61',
            'DE': '49',
            'FR': '33',
            'ES': '34',
            'IT': '39',
            'CN': '86',
            'JP': '81',
            'IN': '91',
            'BR': '55',
            'RU': '7',
            'MX': '52',
            // Add more as needed
          };
          
          // Get the calling code or use 1 (US) as fallback
          const callingCode = callingCodes[selectedCountryCode] || '1';
          
          // Create a properly formatted number with the country code first
          setPhoneNumber(`+${callingCode}${digit}`);
          
          // Also focus on the input field to maintain context
          const phoneInput = document.getElementById('phone-input') as HTMLInputElement;
          if (phoneInput) {
            setTimeout(() => {
              phoneInput.focus();
            }, 0);
          }
        } else {
          // Fallback if we can't find the country select
          setPhoneNumber(`+1${digit}`);
        }
      } else {
        // Otherwise just append the digit
        setPhoneNumber(prev => prev + digit);
      }
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

  // Checking microphone permission
  const recheckMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicPermission('granted');
    } catch (err) {
      console.error('Failed to get microphone access:', err);
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

  return (
    <div className="bg-white shadow-lg rounded-lg max-w-md mx-auto overflow-hidden">
      <div className="p-4 bg-gray-50 flex items-center justify-between border-b">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex space-x-2">
          {!hideHistory && (
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="text-gray-700 rounded-full hover:bg-gray-200 p-2 transition-colors"
            >
              <ClockIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-800 rounded-lg text-sm">
            {error === 'Unable to start call: Permission denied' 
              ? 'Microphone access was denied. Please allow microphone access to make calls.' 
              : error}
          </div>
        )}
        
        {/* Microphone permission handling */}
        {micPermission === 'checking' && (
          <div className="text-center p-4">
            <p>Checking microphone access...</p>
          </div>
        )}
        
        {micPermission === 'denied' && (
          <div className="text-center p-4 bg-red-50 rounded-lg mb-4">
            <MicrophoneIcon className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="font-semibold text-red-700">Microphone access is required for calls</p>
            <p className="text-sm text-red-600 mt-1">Please allow microphone access in your browser settings.</p>
          </div>
        )}
        
        {micPermission === 'prompt' && (
          <div className="text-center p-4 bg-yellow-50 rounded-lg mb-4">
            <MicrophoneIcon className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <p className="font-semibold text-yellow-700">Microphone access is required for calls</p>
            <p className="text-sm text-yellow-600 mt-1">Please allow microphone access when prompted.</p>
            <button 
              onClick={recheckMicrophonePermission}
              className="mt-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition-colors"
            >
              Check Permission
            </button>
          </div>
        )}
        
        {/* Call UI */}
        {micPermission === 'granted' && (
          <>
            {showHistory ? (
              <CallHistory 
                calls={callHistory} 
                onCallClick={handleHistoryCallClick}
              />
            ) : isConnected || isConnecting ? (
              // Active call view
              <div>
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold">
                    {phoneNumber}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {isConnecting ? 'Connecting...' : isAccepted ? 'In Progress' : 'Ringing...'}
                  </p>
                  
                  {callStartTime && isAccepted && (
                    <div className="mt-2">
                      <CallTimer startTime={callStartTime} isActive={true} />
                    </div>
                  )}
                </div>
                
                <AudioVisualizer isActive={isConnected && isAccepted} />
                
                <div className="mt-8">
                  <CallControls 
                    onHangup={hangupCall}
                    onToggleMute={handleToggleMute}
                    disabled={!isConnected}
                  />
                  
                  {/* Dialpad toggle */}
                  <div className="text-center mt-4">
                    <button 
                      onClick={() => setShowDialpad(!showDialpad)}
                      className="text-blue-600 text-sm hover:text-blue-800 focus:outline-none"
                    >
                      {showDialpad ? 'Hide Dialpad' : 'Show Dialpad'}
                    </button>
                  </div>
                </div>
                
                {showDialpad && (
                  <div className="mt-6">
                    <DialPad 
                      onDigitPressed={handleDigitPressed}
                      onBackspace={handleBackspace}
                    />
                  </div>
                )}
              </div>
            ) : isIncomingCall ? (
              // Incoming call view
              <div className="text-center">
                <div className="animate-pulse mb-4">
                  <PhoneIcon className="h-12 w-12 text-green-500 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Incoming Call</h3>
                <p className="text-lg mb-6">Unknown Caller</p>
                
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={rejectCall}
                    className="rounded-full p-4 bg-red-500 text-white hover:bg-red-600"
                  >
                    <PhoneXMarkIcon className="h-6 w-6" />
                  </button>
                  <button
                    onClick={answerCall}
                    className="rounded-full p-4 bg-green-500 text-white hover:bg-green-600"
                  >
                    <PhoneIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
            ) : (
              // Idle phone view with dial pad
              <div>
                {!countrySelected && (
                  <div className="mb-6 text-center p-4 bg-blue-50 rounded-lg">
                    <GlobeAmericasIcon className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <p className="font-medium text-blue-800">Please select a country first</p>
                    <p className="text-sm text-blue-600 mt-1">
                      Select your destination country from the dropdown below to enable dialing
                    </p>
                  </div>
                )}
                
                <div className="mb-6 relative">
                  <PhoneInputWithFlag
                    value={phoneNumber}
                    onChange={setPhoneNumber}
                    placeholder="+1 (234) 567-8900"
                    onFocus={() => {}}
                    onValidityChange={handlePhoneValidityChange}
                    onCountrySelect={handleCountrySelection}
                  />
                  {phoneNumber && (
                    <button
                      onClick={handleClearNumber}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded-full hover:bg-gray-200 transition-colors"
                      aria-label="Clear number"
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
                
                <div className={`${!countrySelected ? 'opacity-50 pointer-events-none' : ''}`}>
                  <DialPad 
                    onDigitPressed={handleDigitPressed}
                    onBackspace={handleBackspace}
                  />
                </div>
                
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleCallSubmit}
                    disabled={!phoneNumber.trim() || !isReady || !isPhoneNumberValid || !countrySelected}
                    className={`rounded-full p-5 flex items-center justify-center
                      ${!phoneNumber.trim() || !isReady || !isPhoneNumberValid || !countrySelected
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    aria-label="Make call"
                    title={!countrySelected ? "Please select a country first" :
                           !isPhoneNumberValid && phoneNumber.trim() ? "Please enter a valid phone number" : "Make call"}
                  >
                    <PhoneArrowUpRightIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 