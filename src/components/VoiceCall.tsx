import React, { useState, FormEvent, useEffect } from 'react';
import { useTwilioDevice } from '@/hooks/useTwilioDevice';
import { PhoneIcon, PhoneXMarkIcon, XCircleIcon } from '@heroicons/react/24/solid';
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
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [showDialpad, setShowDialpad] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [isPhoneNumberValid, setIsPhoneNumberValid] = useState(false);
  const [validatedE164Number, setValidatedE164Number] = useState<string>('');
  const [countrySelected, setCountrySelected] = useState<boolean>(false);
  const [selectedCountry, setSelectedCountry] = useState<Country | undefined>(undefined);
  const [initializationStartTime] = useState<number>(Date.now());
  const [showRefreshButton, setShowRefreshButton] = useState<boolean>(false);
  const [isReinitializing, setIsReinitializing] = useState<boolean>(false);

  const {
    isReady,
    isConnecting,
    isConnected,
    isAccepted,
    error,
    waitingForMicPermission,
    makeCall,
    hangupCall,
    answerCall,
    rejectCall,
    call,
    requestMicrophonePermission,
    reinitializeDevice
  } = useTwilioDevice({ userId });

  // Check for incoming calls - we don't need to handle these anymore since we auto-reject
  useEffect(() => {
    // Auto-rejection is handled at the device level, no need to set UI state for incoming calls
    if (call && !isConnected && !isConnecting) {
      console.log('Incoming call detected but will be automatically rejected');
    }
  }, [call, isConnected, isConnecting]);

  // Update call start time and handle call end
  useEffect(() => {
    // Set call start time for connected calls
    if (isConnected && isAccepted) {
      // Only set if not already set
      if (!callStartTime) {
        const now = Date.now();
        console.log('[VoiceCall] Setting call start time:', now);
        setCallStartTime(now);
      }
    } 
    // Handle call ending
    else if (!isConnected && !isConnecting && callStartTime) {
      console.log('[VoiceCall] Call ended, creating call history entry');
      // Call ended, save to history
      const newCall: CallHistoryEntry = {
        id: Date.now().toString(),
        phoneNumber: validatedE164Number || 
          (selectedCountry ? `+${getCountryCallingCode(selectedCountry)}${nationalPhoneNumber}` : nationalPhoneNumber) || 
          'Unknown', 
        timestamp: callStartTime,
        duration: Math.floor((Date.now() - callStartTime) / 1000),
        direction: isIncomingCall ? 'incoming' : 'outgoing',
        status: 'answered' 
      };
      
      // Update call history
      const updatedHistory = [newCall, ...callHistory].slice(0, 50);
      setCallHistory(updatedHistory);
      
      // Notify parent if callback provided
      if (onHistoryUpdate) {
        onHistoryUpdate(updatedHistory);
      }

      // Reset all call-related state at once
      setCallStartTime(null);
      setCountrySelected(false);
      setSelectedCountry(undefined);
      setNationalPhoneNumber('');
      setIsPhoneNumberValid(false);
      setValidatedE164Number('');
      
      // Reset incoming call flag if needed
      if (isIncomingCall) {
        setIsIncomingCall(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAccepted, isConnected, isConnecting, callStartTime]);

  // Check for initialization taking too long
  useEffect(() => {
    if (!isReady && !error) {
      const timeoutId = setTimeout(() => {
        setShowRefreshButton(true);
      }, 10000); // Show refresh button after 10 seconds
      
      return () => clearTimeout(timeoutId);
    }
  }, [isReady, error]);

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

  // Submit call
  const handleCallSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!selectedCountry) {
      console.error('[handleCallSubmit] No country selected');
      return;
    }
    
    // console.log(`[handleCallSubmit] Attempting call with Country: ${selectedCountry}, NationalNumber: ${nationalPhoneNumber}`);
    const fullNumberToCall = `+${getCountryCallingCode(selectedCountry)}${nationalPhoneNumber}`;
    // console.log(`[handleCallSubmit] Constructed full number: ${fullNumberToCall}`);
    
    // Re-validate just before calling
    const validation = validatePhoneNumber(fullNumberToCall, selectedCountry);
    // console.log(`[handleCallSubmit] Validation Result:`, validation);
    
    if (!validation.isValid || !validation.e164Number) {
        console.error('[handleCallSubmit] Invalid phone number for submission:', fullNumberToCall);
        setIsPhoneNumberValid(false); 
        return;
    }
    
    // If validation passed, use the validated E.164 number
    // console.log(`[handleCallSubmit] Validation passed. Calling startCall with E.164: ${validation.e164Number}`);
    await startCall(validation.e164Number);
  };

  // Start call function
  const startCall = async (e164Number: string) => {
    console.log(`[startCall] Received E.164 number: ${e164Number}`);
    if (!isReady) {
        console.error('[startCall] Device not ready, cannot make call.');
        return;
    }
    console.log(`[startCall] Calling makeCall hook function with: ${e164Number}`);
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

  // Function to handle manual refresh
  const handleRefresh = () => {
    window.location.reload();
  };
  
  // Function to reinitialize the device without refreshing
  const handleReinitialize = () => {
    setIsReinitializing(true);
    reinitializeDevice();
    // Reset the flag after a delay
    setTimeout(() => {
      setIsReinitializing(false);
    }, 3000);
  };

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
        {error && !isReady && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
            <p className="font-medium">Error Initializing Device:</p>
            <p>{error}</p>
            {error.includes('Microphone access') && (
              <div className="mt-3">
                <p className="mb-2">Please grant microphone permission to use the phone.</p>
                <button 
                  onClick={() => requestMicrophonePermission()}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Request Microphone Access
                </button>
              </div>
            )}
            {error.includes('no longer valid') && (
              <div className="mt-3">
                <p className="mb-2">The device needs to be reinitialized.</p>
                <div className="flex space-x-2">
                  <button 
                    onClick={handleReinitialize}
                    disabled={isReinitializing}
                    className={`px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors flex items-center ${isReinitializing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {isReinitializing ? 'Reinitializing...' : 'Reinitialize Device'}
                  </button>
                  <button 
                    onClick={handleRefresh}
                    className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md text-sm font-medium transition-colors flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Page
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Call UI */}
        {(isReady || call || isConnecting || isConnected || isIncomingCall) && !error && (
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
                  
                  <div className="mt-2">
                    <CallTimer 
                      startTime={callStartTime} 
                      isActive={isConnected && isAccepted && callStartTime !== null} 
                    />
                  </div>
                </div>
                
                <AudioVisualizer isActive={isConnected} />
                
                <div className="mt-8">
                  <CallControls 
                    onHangup={hangupCall}
                    onToggleMute={handleToggleMute}
                    disabled={false} /* Always enable controls */
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
                        value=""
                        onChange={() => {}}
                        onCountryChange={handleCountryChange}
                        className="country-selector-only"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mb-6 relative">
                  <PhoneInputWithFlag
                    country={selectedCountry || undefined}
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

        {!isReady && !error && (
            <div className="text-center py-4">
                {/* Spinning loader */}
                <div className="flex justify-center items-center mb-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                </div>
                
                {waitingForMicPermission ? (
                  <>
                    <p className="text-gray-600 mb-1 font-medium">Waiting for Microphone Permission...</p>
                    <p className="text-xs text-gray-500 mb-3">Please allow microphone access in your browser prompt</p>
                    
                    {/* Microphone animation */}
                    <div className="flex justify-center mb-4">
                      <div className="relative w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 mb-2">
                      This permission is required to make and receive calls
                    </div>
                    
                    <button 
                      onClick={() => requestMicrophonePermission()}
                      className="px-3 py-1.5 mt-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors"
                    >
                      Request Permission Again
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-gray-600 mb-1 font-medium">Initializing Phone...</p>
                    <p className="text-xs text-gray-500 mb-3">Please wait while we establish a secure connection</p>
                    
                    {/* Loading dots */}
                    <div className="flex justify-center space-x-2 mb-4">
                      <div className="h-2 w-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="h-2 w-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </>
                )}
                
                {showRefreshButton && !waitingForMicPermission && (
                    <div className="mt-4">
                        <p className="text-sm text-amber-600 mb-2">Initialization is taking longer than expected.</p>
                        <button 
                            onClick={handleRefresh}
                            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                        >
                            Refresh Page
                        </button>
                    </div>
                )}
                
                <div className="mt-4 text-xs text-gray-400">
                    {waitingForMicPermission 
                      ? "Waiting for microphone access..." 
                      : `Initializing for ${Math.floor((Date.now() - initializationStartTime) / 1000)}s`}
                </div>
            </div>
        )}
      </div>
    </div>
  );
} 