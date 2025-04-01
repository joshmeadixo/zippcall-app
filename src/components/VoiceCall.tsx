import React, { useState, FormEvent, useEffect, useRef, forwardRef, useImperativeHandle, ForwardRefRenderFunction, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTwilioDevice } from '@/hooks/useTwilioDevice';
import { PhoneIcon, PhoneXMarkIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { ClockIcon, GlobeAmericasIcon } from '@heroicons/react/24/outline';
import DialPad from './DialPad';
import CallTimer from './CallTimer';
import CallControls from './CallControls';
import AudioVisualizer from './AudioVisualizer';
import CallHistory, { CallHistoryEntry } from './CallHistory';
import PhoneInputWithFlag from './phone/PhoneInput';
import PhoneInputCountry from './phone/PhoneInputCountry';
import { validatePhoneNumber, detectCountryFromE164, extractNationalNumber } from '@/utils/phoneValidation';
import { Country, getCountryCallingCode } from 'react-phone-number-input';
import CallPricing from './CallPricing';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface VoiceCallProps {
  title?: string;
  userId?: string;
  hideHistory?: boolean;
  onHistoryUpdate?: (history: CallHistoryEntry[]) => void;
}

// Define the handle type for the forwarded ref
export interface VoiceCallHandle {
  callNumber: (phoneNumber: string) => Promise<void>;
}

// Define interface for pricing information
interface PricingInfo {
  finalPrice?: number;
  currentCost?: number;
}

// Define minimum balance threshold
const MIN_BALANCE_THRESHOLD = 0.15;

// Convert to ForwardRefRenderFunction
const VoiceCall: ForwardRefRenderFunction<VoiceCallHandle, VoiceCallProps> = (
  { 
    title = "Phone", 
    userId = "", 
    hideHistory = false, 
    onHistoryUpdate 
  }, 
  ref
) => {
  const { user } = useAuth();
  const [nationalPhoneNumber, setNationalPhoneNumber] = useState('');
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [showDialpad, setShowDialpad] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [callRecordError, setCallRecordError] = useState<string | null>(null);
  const [isPhoneNumberValid, setIsPhoneNumberValid] = useState(false);
  const [validatedE164Number, setValidatedE164Number] = useState<string>('');
  const [countrySelected, setCountrySelected] = useState<boolean>(false);
  const [selectedCountry, setSelectedCountry] = useState<Country | undefined>(undefined);
  const [initializationStartTime] = useState<number>(Date.now());
  const [showRefreshButton, setShowRefreshButton] = useState<boolean>(false);
  const [isReinitializing, setIsReinitializing] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Kept for future error handling
  const [error, setError] = useState<string | null>(null);
  const pricingRef = useRef<PricingInfo>({});
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true); // Start loading initially
  const [balanceFetchError, setBalanceFetchError] = useState<string | null>(null);
  // Add state to track the real-time cost of the current call
  const [currentCallCost, setCurrentCallCost] = useState(0);

  const {
    isReady,
    isConnecting,
    isConnected,
    isAccepted,
    waitingForMicPermission,
    makeCall,
    hangupCall,
    answerCall,
    rejectCall,
    call,
    requestMicrophonePermission,
    reinitializeDevice
  } = useTwilioDevice({ userId });

  // Fetch user balance from Firestore using a real-time listener
  useEffect(() => {
    if (!user || !user.uid) {
      // If no user, set balance to null and stop loading
      setUserBalance(null);
      setIsLoadingBalance(false);
      setBalanceFetchError(null); // Clear any previous error
      return; // Exit effect
    }

    // Start loading when user is available
    setIsLoadingBalance(true);
    setBalanceFetchError(null);
    console.log(`[VoiceCall] Setting up balance listener for user ${user.uid}`);
    const userRef = doc(db, 'users', user.uid);

    // Use onSnapshot for real-time updates
    const unsubscribe = onSnapshot(userRef, 
      (docSnap) => {
        // Listener callback
        if (docSnap.exists()) {
          const userData = docSnap.data();
          const balance = typeof userData.balance === 'number' ? userData.balance : 0;
          setUserBalance(balance);
          console.log(`[VoiceCall] Balance updated via listener: ${balance}`);
          setBalanceFetchError(null); // Clear error on successful update
        } else {
          console.warn(`[VoiceCall] User document snapshot not found for UID: ${user.uid}. Setting balance to 0.`);
          setUserBalance(0); 
          setBalanceFetchError('User profile not found.');
        }
        setIsLoadingBalance(false); // Stop loading after first snapshot or update
      },
      (error) => {
        // Error handler for the listener
        console.error('[VoiceCall] Error listening to user balance:', error);
        setUserBalance(0); // Default to 0 on listener error
        setBalanceFetchError('Could not load balance.');
        setIsLoadingBalance(false);
      }
    );

    // Cleanup function: Unsubscribe the listener when the component unmounts or user changes
    return () => {
      console.log(`[VoiceCall] Unsubscribing balance listener for user ${user.uid}`);
      unsubscribe();
    };

  }, [user]); // Re-run effect if user object changes

  // Check for incoming calls - we don't need to handle these anymore since we auto-reject
  useEffect(() => {
    // Auto-rejection is handled at the device level, no need to set UI state for incoming calls
    if (call && !isConnected && !isConnecting) {
      console.log('Incoming call detected but will be automatically rejected');
    }
  }, [call, isConnected, isConnecting]);

  // Monitor connection state changes to detect call start/end
  useEffect(() => {
    // Detect call start
    if (isConnected && !callStartTime) {
      console.log('[VoiceCall] Call connected, recording start time');
      setCallStartTime(Date.now());
    } 
    // Handle call ending
    else if (!isConnected && !isConnecting && callStartTime) {
      const handleCallEnd = async () => {
        // Clear any previous recording errors
        setCallRecordError(null);
        
        console.log('[VoiceCall] Call ended, preparing call record.');
        
        const duration = Math.floor((Date.now() - callStartTime) / 1000);
        // Ensure cost is a non-negative number, default to 0 if unavailable
        const finalCost = (pricingRef.current?.currentCost !== undefined && pricingRef.current.currentCost >= 0) 
                          ? pricingRef.current.currentCost 
                          : 0; 

        console.log(`[VoiceCall] Final call cost determined: ${finalCost}`);

        const newCall: CallHistoryEntry = {
          id: call?.parameters.CallSid || Date.now().toString(), // Use CallSid if available, fallback to timestamp
          phoneNumber: validatedE164Number || 
            (selectedCountry ? `+${getCountryCallingCode(selectedCountry)}${nationalPhoneNumber}` : nationalPhoneNumber) || 
            'Unknown', 
          timestamp: callStartTime, // Keep as JS timestamp for sending to API
          duration: duration,
          direction: isIncomingCall ? 'incoming' : 'outgoing',
          status: 'answered', // Assuming answered if it reached this point
          cost: finalCost 
        };

        // Call the API to record the call and deduct cost
        if (user && newCall.cost !== undefined) { // Ensure user is available and cost is defined
          try {
            console.log(`[VoiceCall] Attempting to record call ${newCall.id} via API for user ${user.uid}`);
            const token = await user.getIdToken();
            
            const response = await fetch('/api/call-cost', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify(newCall),
            });

            if (!response.ok) {
              const jsonResponse = await response.json();
              // If there was an error, throw it for the catch block to handle
              throw new Error(jsonResponse.error || 'Failed to record call history');
            }

            // --- Success Case --- 
            const data = await response.json();
            console.log(`[VoiceCall] Successfully recorded call ${newCall.id}. New balance: ${data.newBalance}`);
            // Update local call history STATE *only* on successful recording
            const updatedHistory = [newCall, ...callHistory].slice(0, 50);
            setCallHistory(updatedHistory);
            
            // Sync with parent component if callback exists
            if (onHistoryUpdate) {
              onHistoryUpdate(updatedHistory);
            }

          } catch (error: unknown) {
            console.error('[VoiceCall] Error recording call:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
            setCallRecordError(errorMessage);
            // Even if there's an error, we should still reset the call state
          } finally {
            setCallStartTime(null);
            setCurrentCallCost(0); // Reset current call cost
            // Update pricing ref to ensure it doesn't hold stale values
            pricingRef.current = {};
          }
        } else if (!user) {
          console.warn('[VoiceCall] Cannot record call: User not authenticated.');
          setCallRecordError('Authentication error. Cannot record call.');
        } else {
           console.warn(`[VoiceCall] Cannot record call ${newCall.id}: Cost is undefined.`);
           // Don't set an error message here, as cost might be legitimately unavailable for some calls?
           // Or potentially set specific error?
        }

        // Reset call state regardless of API call success/failure
        setCountrySelected(false);
        setSelectedCountry(undefined);
        setNationalPhoneNumber('');
        setIsPhoneNumberValid(false);
        setValidatedE164Number('');
        if (isIncomingCall) {
          setIsIncomingCall(false);
        }
      };
      
      handleCallEnd();
    }
  }, [isAccepted, isConnected, isConnecting, callStartTime, user, validatedE164Number, selectedCountry, nationalPhoneNumber, isIncomingCall, callHistory, onHistoryUpdate, call]);

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

  // Handle submitting the call
  const handleCallSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // --- PRE-CALL CHECKS --- 
    // Check device readiness and connection status
    if (!isReady || isConnecting || isConnected) {
      console.warn('[handleCallSubmit] Call prevented: Device not ready or already connected/connecting.');
      return;
    }
    // Check if phone number is considered valid by the input component
    if (!isPhoneNumberValid) {
      console.warn('[handleCallSubmit] Call prevented: Phone number is not valid.');
       // Optionally set an error state here if needed
      return;
    }
    // Check if balance is still loading
    if (isLoadingBalance) {
      console.warn('[handleCallSubmit] Call prevented: Balance is still loading.');
      // Show loading indicator or disable button (already handled by isCallButtonDisabled)
      return;
    }
    // Check balance against threshold
    if (userBalance === null || userBalance <= MIN_BALANCE_THRESHOLD) {
      console.warn(`[handleCallSubmit] Call prevented due to low balance: ${userBalance}`);
      // Error message is already displayed conditionally via lowBalanceMessage
      return;
    }
    // --- END PRE-CALL CHECKS ---
    
    // Clear previous recording errors before starting call attempt
    setCallRecordError(null);

    console.log('[handleCallSubmit] Attempting to format and validate number before calling.');

    if (!selectedCountry) {
        console.error('[handleCallSubmit] No country selected.');
        return; // Or set an error state
    }
    
    const fullNumberToCall = `+${getCountryCallingCode(selectedCountry)}${nationalPhoneNumber}`;
    
    // Re-validate just before calling (important!)
    const validation = validatePhoneNumber(fullNumberToCall, selectedCountry);
    
    if (!validation.isValid || !validation.e164Number) {
        console.error('[handleCallSubmit] Invalid phone number for submission:', fullNumberToCall);
        setIsPhoneNumberValid(false); // Update state if validation fails here
        // Optionally set a user-facing error message
        return;
    }
    
    // If validation passed, use the validated E.164 number and start the call
    console.log(`[handleCallSubmit] Validation passed. Starting call to: ${validation.e164Number}`);
    // Hide dialpad/history when call starts
    setShowDialpad(false); 
    setShowHistory(false); 
    await startCall(validation.e164Number); 
  };

  // Start call function (This function actually calls the Twilio hook)
  const startCall = async (e164Number: string) => {
    // No balance check needed here as it's done in handleCallSubmit
    console.log(`[startCall] Received E.164 number: ${e164Number}`);
    if (!isReady) {
        console.error('[startCall] Device not ready, cannot make call.');
        return; // Should have been caught by handleCallSubmit, but check again
    }
    console.log(`[startCall] Calling makeCall hook function with: ${e164Number}`);
    setValidatedE164Number(e164Number); // Ensure validated number is stored for history
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
      console.log(`[handleHistoryCallClick] Call history number clicked: ${number}`);
      
      // Check if the number is in E.164 format (starts with +)
      if (number.startsWith('+')) {
        // Detect the country from the phone number
        const detectedCountry = detectCountryFromE164(number);
        
        if (detectedCountry) {
          // We detected a country, now we need to extract the national number
          const detectedNationalNumber = extractNationalNumber(number);
          
          if (detectedNationalNumber) {
            console.log(`[handleHistoryCallClick] Detected country: ${detectedCountry}, national number: ${detectedNationalNumber}`);
            
            // Update country and phone number with a small delay between state updates
            setCountrySelected(true);
            setSelectedCountry(detectedCountry as Country);
            
            // Use setTimeout to ensure the country selection is processed first
            setTimeout(() => {
              // Now set the phone number
              setNationalPhoneNumber(detectedNationalNumber);
              
              // Hide the history panel to show the phone UI
              setShowHistory(false);
              
              // Validate the number
              const fullNumber = `+${getCountryCallingCode(detectedCountry as Country)}${detectedNationalNumber}`;
              const validation = validatePhoneNumber(fullNumber, detectedCountry);
              
              if (validation.isValid && validation.e164Number) {
                setIsPhoneNumberValid(true);
                setValidatedE164Number(validation.e164Number);
                
                // Don't start the call automatically
                console.log('[handleHistoryCallClick] Phone number prepared for calling, awaiting user confirmation');
              } else {
                console.error(`[handleHistoryCallClick] Number validation failed: ${JSON.stringify(validation)}`);
              }
            }, 50); // Small delay of 50ms
          } else {
            console.error(`[handleHistoryCallClick] Could not extract national number from ${number}`);
          }
        } else {
          console.error(`[handleHistoryCallClick] Could not detect country for ${number}`);
        }
      } else {
        // Not E.164 format, just fill in the number field
        setNationalPhoneNumber(number);
        setShowHistory(false);
      }
    }
  };

  // Handle deleting a call history entry
  const handleDeleteHistoryEntry = (callId: string) => {
    console.log(`[handleDeleteHistoryEntry] Deleting call history entry: ${callId}`);
    
    // Update local call history by filtering out the deleted call
    const updatedHistory = callHistory.filter(call => call.id !== callId);
    setCallHistory(updatedHistory);
    
    // Notify parent component if callback provided
    if (onHistoryUpdate) {
      onHistoryUpdate(updatedHistory);
    }
    
    // If userId is provided, also delete from Firestore
    if (userId) {
      // Import here to avoid circular dependency
      import('@/lib/call-history-db').then(module => {
        const { deleteCallHistoryEntry } = module;
        
        deleteCallHistoryEntry(callId, userId)
          .then(success => {
            if (success) {
              console.log(`[handleDeleteHistoryEntry] Successfully deleted call from Firestore: ${callId}`);
            } else {
              console.error(`[handleDeleteHistoryEntry] Failed to delete call from Firestore: ${callId}`);
            }
          })
          .catch(error => {
            console.error('[handleDeleteHistoryEntry] Error deleting call from Firestore:', error);
          });
      });
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

  // Define the handleHangup function with useCallback before it's used in the useEffect
  const handleHangup = useCallback(() => {
    console.log('[VoiceCall] Hanging up manually');
    hangupCall();
    // Reset call state
    setCountrySelected(false);
    setSelectedCountry(undefined);
    setValidatedE164Number('');
    setNationalPhoneNumber('');
    setCurrentCallCost(0);
  }, [hangupCall]);

  // Add useEffect for monitoring balance during active call
  useEffect(() => {
    // Only monitor if the call is connected and we have balance info
    if (isConnected && userBalance !== null && currentCallCost > 0) {
      if (currentCallCost >= userBalance) {
        console.warn(`[VoiceCall Monitor] Insufficient balance detected (Cost: ${currentCallCost}, Balance: ${userBalance}). Hanging up call.`);
        // Trigger the hangup process
        handleHangup(); 
      }
    }
    // Dependencies: Run when connection status, balance, or cost changes
  }, [isConnected, userBalance, currentCallCost, handleHangup]);

  // Update handlePricingInfo to store the current cost in state
  const handlePricingInfo = (price: number, cost: number) => {
    // Store latest price/cost in ref for use in handleCallEnd
    pricingRef.current = { finalPrice: price, currentCost: cost };
    // Update state for real-time monitoring
    setCurrentCallCost(cost); 
  };
  
  // Expose callNumber method via ref
  useImperativeHandle(ref, () => ({
    callNumber: async (phoneNumber: string) => {
      if (isConnected || isConnecting) {
        console.error('[callNumber] Cannot prepare a new call while a call is in progress');
        return;
      }

      console.log(`[callNumber] Received request to prepare call for: ${phoneNumber}`);
      
      // Check if the number is in E.164 format (starts with +)
      if (phoneNumber.startsWith('+')) {
        // Detect the country from the phone number
        const detectedCountry = detectCountryFromE164(phoneNumber);
        
        if (detectedCountry) {
          // We detected a country, now we need to extract the national number
          const detectedNationalNumber = extractNationalNumber(phoneNumber);
          
          if (detectedNationalNumber) {
            console.log(`[callNumber] Detected country: ${detectedCountry}, national number: ${detectedNationalNumber}`);
            
            // Update country and phone number with a small delay between state updates
            setCountrySelected(true);
            setSelectedCountry(detectedCountry as Country);
            
            // Use setTimeout to ensure the country selection is processed first
            setTimeout(() => {
              // Now set the phone number
              setNationalPhoneNumber(detectedNationalNumber);
              
              // Validate the number
              const fullNumber = `+${getCountryCallingCode(detectedCountry as Country)}${detectedNationalNumber}`;
              const validation = validatePhoneNumber(fullNumber, detectedCountry);
              
              if (validation.isValid && validation.e164Number) {
                setIsPhoneNumberValid(true);
                setValidatedE164Number(validation.e164Number);
                
                // Don't start the call automatically, just set up the UI
                console.log('[callNumber] Phone number prepared for calling, awaiting user confirmation');
              } else {
                console.error(`[callNumber] Number validation failed: ${JSON.stringify(validation)}`);
              }
            }, 50); // Small delay of 50ms
          } else {
            console.error(`[callNumber] Could not extract national number from ${phoneNumber}`);
          }
        } else {
          console.error(`[callNumber] Could not detect country for ${phoneNumber}`);
        }
      } else {
        // Not in E.164 format
        console.error(`[callNumber] Phone number must be in E.164 format (start with +): ${phoneNumber}`);
      }
    }
  }));

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
        
        {/* Display Call Recording Error */}
        {callRecordError && (
          <div className="my-3 p-2 bg-red-100 text-red-700 text-sm rounded-md text-center">
            {callRecordError}
          </div>
        )}
        
        {/* Display Balance Fetch Error */}
        {balanceFetchError && (
           <div className="my-2 p-2 bg-yellow-100 text-yellow-800 text-sm rounded-md text-center">
              Balance Error: {balanceFetchError}
           </div>
        )}
        
        {/* Call UI */}
        {(isReady || call || isConnecting || isConnected || isIncomingCall) && !error && (
          <>
            {showHistory ? (
              <CallHistory 
                calls={callHistory} 
                onCallClick={handleHistoryCallClick}
                onDeleteClick={handleDeleteHistoryEntry}
              />
            ) : isConnected || isConnecting ? (
              // Active call view - **MODIFIED TO SHOW E.164 NUMBER**
              <div>
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold">
                    {/* Display the validated E.164 number */} 
                    {validatedE164Number || 'Unknown Number'} 
                  </h3>
                  <p className="text-sm text-gray-500">
                    {isConnecting && !isConnected ? 'Connecting...' : isConnected && isAccepted ? 'In Progress' : 'Ringing...'}
                  </p>
                  
                  <div className="mt-2">
                    <CallTimer 
                      startTime={callStartTime} 
                      isActive={isConnected && isAccepted && callStartTime !== null} 
                    />
                  </div>
                </div>
                
                <AudioVisualizer isActive={isConnected} />
                
                {/* Add pricing component to active call view */}
                {isConnected && isAccepted && (
                  <div className="mt-4 mb-3">
                    <CallPricing 
                      phoneNumber={validatedE164Number}
                      isCallActive={isConnected}
                      callStartTime={callStartTime}
                      onPricingUpdate={handlePricingInfo}
                      userBalance={userBalance}
                      isLoadingBalance={isLoadingBalance}
                    />
                  </div>
                )}
                
                <div className="mt-8">
                  <CallControls 
                    onHangup={handleHangup}
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
                        value={selectedCountry ? `+${getCountryCallingCode(selectedCountry)}` : ""}
                        onChange={() => {}}
                        onCountryChange={handleCountryChange}
                        defaultCountry={selectedCountry}
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
                
                {countrySelected && 
                 nationalPhoneNumber.trim() && 
                 isPhoneNumberValid && 
                 !!validatedE164Number && (
                  <div className="mt-4 mb-3">
                    <CallPricing 
                      phoneNumber={validatedE164Number}
                      isCallActive={false}
                      onPricingUpdate={handlePricingInfo}
                      userBalance={userBalance}
                      isLoadingBalance={isLoadingBalance}
                    />
                  </div>
                )}
                
                {/* Call Button */}
                <button
                  onClick={handleCallSubmit} 
                  disabled={
                    !isReady || 
                    isConnecting || 
                    isConnected || 
                    !selectedCountry || 
                    !nationalPhoneNumber.trim() || 
                    !isPhoneNumberValid ||
                    isLoadingBalance ||
                    (userBalance !== null && userBalance <= MIN_BALANCE_THRESHOLD)
                  }
                  className={`w-full mt-4 py-3 px-4 rounded-lg text-white font-semibold flex items-center justify-center transition-colors ${ 
                    (!isReady || isConnecting || isConnected || !selectedCountry || !nationalPhoneNumber.trim() || !isPhoneNumberValid || isLoadingBalance || (userBalance !== null && userBalance <= MIN_BALANCE_THRESHOLD))
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                  title={
                    !isReady ? "Phone not ready" : 
                    isConnecting ? "Connecting..." : 
                    isConnected ? "Call in progress" : 
                    !selectedCountry ? "Select a country" : 
                    !nationalPhoneNumber.trim() ? "Enter a phone number" : 
                    !isPhoneNumberValid ? "Invalid phone number" : 
                    isLoadingBalance ? "Checking balance..." : 
                    (userBalance !== null && userBalance <= MIN_BALANCE_THRESHOLD) ? "Insufficient balance" : 
                    "Call"
                  }
                >
                  <PhoneIcon className="h-5 w-5 mr-2" />
                  Call
                </button>
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
};

export default forwardRef(VoiceCall); 