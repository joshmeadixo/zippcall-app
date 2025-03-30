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
import PhoneInputCountry from './phone/PhoneInputCountry';
import { validatePhoneNumber } from '@/utils/phoneValidation';
import { Country, getCountryCallingCode } from 'react-phone-number-input';

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
  const [nationalPhoneNumber, setNationalPhoneNumber] = useState('');
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
  const [selectedCountry, setSelectedCountry] = useState<Country>('US');

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

  // Update call start time when call is accepted - **MODIFIED FOR HISTORY**
  useEffect(() => {
    if (isAccepted && !callStartTime) {
      setCallStartTime(Date.now());
    } else if (!isConnected && callStartTime) {
      // Call ended, save to history
      const newCall: CallHistoryEntry = {
        id: Date.now().toString(),
        // Use the validated E.164 number for history
        phoneNumber: validatedE164Number || `+${getCountryCallingCode(selectedCountry)}${nationalPhoneNumber}` || 'Unknown', // Fallback if validation didn't run
        timestamp: callStartTime,
        duration: Math.floor((Date.now() - callStartTime) / 1000),
        direction: isIncomingCall ? 'incoming' : 'outgoing',
        status: 'answered' // Assuming answered if it was connected
      };
      
      const updatedHistory = [newCall, ...callHistory].slice(0, 50); 
      setCallHistory(updatedHistory);
      setCallStartTime(null);
      
      if (onHistoryUpdate) {
        onHistoryUpdate(updatedHistory);
      }
    }
  // Ensure dependencies are correct, including validatedE164Number
  }, [isAccepted, isConnected, callStartTime, nationalPhoneNumber, validatedE164Number, selectedCountry, isIncomingCall, callHistory, onHistoryUpdate]);

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

  const handlePhoneValidityChange = (isValid: boolean, e164Number?: string) => {
    setIsPhoneNumberValid(isValid);
    setValidatedE164Number(e164Number || '');
  };

  const handleCountryChange = (country: Country | undefined) => {
    if (!country) return;
    
    setSelectedCountry(country);
    setCountrySelected(true);
    setNationalPhoneNumber('');
    setIsPhoneNumberValid(false);
    setValidatedE164Number('');
  };

  const handleCallSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    const fullNumberToCall = `+${getCountryCallingCode(selectedCountry)}${nationalPhoneNumber}`;
    
    const validation = validatePhoneNumber(fullNumberToCall, selectedCountry);
    if (!validation.isValid || !validation.e164Number) {
        console.error('Invalid phone number for submission:', fullNumberToCall);
        setIsPhoneNumberValid(false);
        return;
    }
    
    await startCall(validation.e164Number);
  };

  const startCall = async (e164Number: string) => {
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
    
    await makeCall(e164Number);
  };

  const handleDigitPressed = (digit: string) => {
    if (isConnected && call) {
      call.sendDigits(digit);
    } else if (countrySelected) {
        setNationalPhoneNumber(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    if (countrySelected) {
        setNationalPhoneNumber(prev => prev.slice(0, -1));
    }
  };

  const handleClearNumber = () => {
    setNationalPhoneNumber('');
  };

  const handleHistoryCallClick = (number: string) => {
    if (!isConnected && !isConnecting) {
      setNationalPhoneNumber(number);
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
              // Active call view - **MODIFIED TO SHOW E.164 NUMBER**
              <div>
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold">
                    {/* Display the validated E.164 number */} 
                    {validatedE164Number || 'Connecting...'} 
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
                  <div className="mb-2 text-center p-2 bg-blue-50 rounded-lg">
                    <div className="flex items-center">
                      <GlobeAmericasIcon className="h-5 w-5 text-blue-500 mr-2" />
                      <p className="font-medium text-blue-800 text-sm">Please select a country first</p>
                    </div>
                  </div>
                )}
                
                {/* Separate country selector */}
                <div className={`mb-3 p-2 rounded-lg border relative z-20 overflow-visible ${countrySelected ? 'border-green-300 bg-green-50' : 'border-blue-300 bg-blue-50'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-700">
                      {countrySelected ? "Selected Country" : "Select Country"}
                    </label>
                    {countrySelected && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        <svg className="mr-1 h-2 w-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Selected
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-1 relative z-10 phone-selector-container" style={{ overflow: 'visible' }}>
                    <div className="max-w-xs mx-auto">
                      <PhoneInputCountry
                        international
                        countryCallingCodeEditable={false}
                        defaultCountry="US"
                        value=""
                        onChange={() => {}}
                        onCountryChange={handleCountryChange}
                        className="country-selector-only"
                        inputClass="hidden"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mb-6 relative">
                  <PhoneInputWithFlag
                    country={selectedCountry}
                    nationalNumber={nationalPhoneNumber}
                    onNationalNumberChange={setNationalPhoneNumber}
                    placeholder="Enter number"
                    onFocus={() => {
                      if (!countrySelected) {
                        // Alert user to select a country first
                        alert("Please select a country first");
                      }
                    }}
                    onValidityChange={handlePhoneValidityChange}
                    disabled={!countrySelected}
                  />
                  {nationalPhoneNumber && countrySelected && (
                    <button
                      onClick={handleClearNumber}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded-full hover:bg-gray-100 transition-colors"
                      aria-label="Clear number"
                      style={{ zIndex: 5 }}
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
                    disabled={!isReady || !countrySelected || !nationalPhoneNumber.trim()}
                    className={`rounded-full p-5 flex items-center justify-center 
                      ${!isReady || !countrySelected || !nationalPhoneNumber.trim()
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    aria-label="Make call"
                    title={!countrySelected ? "Please select a country first" :
                           !nationalPhoneNumber.trim() ? "Please enter a phone number" :
                           !isPhoneNumberValid ? "Phone number may be invalid" : "Make call"}
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