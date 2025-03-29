'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import PhoneInput, { Country } from '@/components/PhoneInput';

// Priority countries when multiple countries share the same dial code
const PRIORITY_COUNTRIES = {
  '+1': 'US',  // Prefer US over Canada for +1
  '+44': 'GB', // Prefer UK over other +44 territories
  '+61': 'AU', // Prefer Australia over other territories
  '+7': 'RU',  // Prefer Russia over Kazakhstan
  '+86': 'CN', // China
  '+91': 'IN', // India
  '+49': 'DE', // Germany
  '+33': 'FR', // France
  '+39': 'IT', // Italy
  '+34': 'ES', // Spain
  '+81': 'JP', // Japan
  '+52': 'MX', // Mexico
  '+55': 'BR', // Brazil
};

// Function to detect country from a phone number
const detectCountryFromNumber = (number: string, countries: Country[]): {country: Country | null, localNumber: string} => {
  // Must start with + to be a country code
  if (!number.startsWith('+')) {
    return { country: null, localNumber: number };
  }
  
  // First check for priority countries
  for (const [dialCode, countryCode] of Object.entries(PRIORITY_COUNTRIES)) {
    if (number.startsWith(dialCode)) {
      const priorityCountry = countries.find(c => c.code === countryCode);
      if (priorityCountry) {
        return { 
          country: priorityCountry, 
          localNumber: number.substring(dialCode.length)
        };
      }
    }
  }
  
  // Then try different lengths of dial codes (from longest to shortest)
  for (let i = 5; i >= 1; i--) {
    if (number.length < i + 1) continue;
    
    const dialCode = number.substring(0, i + 1); // Include the +
    const country = countries.find(c => c.dial_code === dialCode);
    if (country) {
      return { 
        country, 
        localNumber: number.substring(dialCode.length)
      };
    }
  }
  
  return { country: null, localNumber: number };
};

// Default initial country as a fallback
const DEFAULT_COUNTRY = {
  code: 'US',
  name: 'United States',
  dial_code: '+1', 
  flag: '🇺🇸'
};

// Placeholder for when the country cannot be determined yet
const NO_REGION_COUNTRY = {
  code: 'NONE',
  name: 'No Region',
  dial_code: '+', 
  flag: '🌍'
};

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [countries, setCountries] = useState<Country[]>([DEFAULT_COUNTRY]);
  const [isCalling, setIsCalling] = useState(false);
  const [callInProgress, setCallInProgress] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [processedLongPress, setProcessedLongPress] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected' | 'failed'>('idle');
  const [callDetails, setCallDetails] = useState<{
    callSid?: string;
    from?: string;
    timestamp?: string;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      // If not authenticated, redirect to login page
      router.push('/');
    }
  }, [user, loading, router]);

  // Fetch countries list on component mount
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch('/api/countries');
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            setCountries(data);
          }
        }
      } catch (error) {
        console.error('Error fetching countries:', error);
      }
    };
    
    fetchCountries();
  }, []);

  const handleDigitClick = (digit: string | number) => {
    const newNumber = phoneNumber + digit;
    setPhoneNumber(newNumber);
    
    // If the number starts with +, try to detect country
    if (newNumber.startsWith('+')) {
      const { country: detectedCountry, localNumber } = detectCountryFromNumber(newNumber, countries);
      if (detectedCountry) {
        if (detectedCountry.code !== selectedCountry.code) {
          setSelectedCountry(detectedCountry);
          // Update the phone number to show only the local part
          setPhoneNumber(localNumber);
        }
      } else if (selectedCountry.code !== 'NONE') {
        // If the number starts with + but we can't detect a country yet, show "No Region"
        setSelectedCountry(NO_REGION_COUNTRY);
      }
    }
  };

  const handleZeroButtonDown = () => {
    // Clear any existing timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    
    setProcessedLongPress(false);
    
    // Set a new long press timer
    longPressTimerRef.current = setTimeout(() => {
      const newNumber = phoneNumber + '+';
      setPhoneNumber(newNumber);
      setProcessedLongPress(true);
      
      // When a + is added, initially set to "No Region" until we can determine the country
      setSelectedCountry(NO_REGION_COUNTRY);
      
      // Try to detect country code if there's already a number after the +
      if (newNumber.length > 1) {
        const { country: detectedCountry, localNumber } = detectCountryFromNumber(newNumber, countries);
        if (detectedCountry) {
          setSelectedCountry(detectedCountry);
          // Update the phone number to show only the local part
          setPhoneNumber(localNumber);
        }
      }
    }, 700);
  };
  
  const handleZeroButtonUp = () => {
    // Clear the timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // Only add '0' if we didn't already process a long press
    if (!processedLongPress) {
      handleDigitClick('0');
    }
  };

  const handleDeleteDigit = () => {
    const newNumber = phoneNumber.slice(0, -1);
    setPhoneNumber(newNumber);
    
    // Check if we need to update the country after deletion
    if (newNumber.startsWith('+')) {
      // Try to detect a different country from the remaining digits
      const { country: detectedCountry, localNumber } = detectCountryFromNumber(newNumber, countries);
      if (detectedCountry) {
        if (detectedCountry.code !== selectedCountry.code) {
          setSelectedCountry(detectedCountry);
          // Update the phone number to show only the local part
          setPhoneNumber(localNumber);
        }
      } else if (selectedCountry.code !== 'NONE') {
        // If we can't detect a country but still have a + prefix, show "No Region"
        setSelectedCountry(NO_REGION_COUNTRY);
      }
    } else if (phoneNumber.startsWith('+') && !newNumber.startsWith('+')) {
      // If we deleted the plus sign, revert to default country
      setSelectedCountry(DEFAULT_COUNTRY);
    }
  };

  const handleCall = async () => {
    if (!phoneNumber || isCalling || callInProgress) return;
    
    // Create the full international number for the call
    const fullNumber = selectedCountry.code === 'NONE' 
      ? phoneNumber  // If no region, use as is (already has +)
      : selectedCountry.dial_code + phoneNumber;  // Otherwise add the country code
    
    setIsCalling(true);
    setCallStatus('calling');
    
    try {
      // Get the current user's Firebase token
      const idToken = await user?.getIdToken();
      
      if (!idToken) {
        throw new Error('Authentication required');
      }
      
      // Call our API endpoint to initiate the call
      const response = await fetch('/api/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ to: fullNumber })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate call');
      }
      
      // Store call details
      setCallDetails({
        callSid: data.callSid,
        from: data.from,
        timestamp: data.timestamp
      });
      
      // Update UI to show call in progress
      setIsCalling(false);
      setCallInProgress(true);
      setCallStatus('connected');
      
      // Poll call status (in a real implementation, you would use webhooks)
      // For this demo, we'll simulate call ending after 30 seconds
      setTimeout(() => {
        setCallInProgress(false);
        setCallStatus('idle');
        setCallDetails(null);
      }, 30000);
      
    } catch (error: any) {
      console.error('Error making call:', error);
      setIsCalling(false);
      setCallStatus('failed');
      
      // Show error message (in a real app, use a proper toast/notification)
      alert(`Call failed: ${error.message}`);
      
      // Reset after a few seconds
      setTimeout(() => {
        setCallStatus('idle');
      }, 5000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="loading loading-spinner loading-lg text-zippcall-blue"></div>
        <p className="mt-4 text-zippcall-blue">Loading your account...</p>
      </div>
    );
  }

  if (!user) {
    return null; // This will not render as the useEffect will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zippcall-light-blue/10 to-white">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-10 h-10 relative mr-2">
              <Image 
                src="/images/zippcall-logo.png" 
                alt="ZippCall Logo" 
                width={40} 
                height={40}
                className="object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-zippcall-blue">ZippCall</h1>
          </div>
          
          <div className="flex items-center">
            <span className="mr-4 text-zippcall-blue">
              {user.email || 'User'}
            </span>
            <button 
              onClick={signOut} 
              className="btn btn-sm btn-outline"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Account Overview */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-bold text-zippcall-blue mb-2">Welcome to ZippCall</h2>
            <p className="text-gray-600 mb-4">Your international calling solution.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card bg-base-100 shadow-sm border border-gray-100">
                <div className="card-body p-4">
                  <h3 className="card-title text-zippcall-blue text-lg flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                    </svg>
                    Current Balance
                  </h3>
                  <p className="text-2xl font-bold">$10.00</p>
                  <div className="text-sm text-gray-500">
                    Approximately 60 minutes of calls
                  </div>
                  <button className="btn btn-sm btn-primary mt-2">Add Credits</button>
                </div>
              </div>
              
              <div className="card bg-base-100 shadow-sm border border-gray-100">
                <div className="card-body p-4">
                  <h3 className="card-title text-zippcall-blue text-lg flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    Recent Activity
                  </h3>
                  <div className="text-sm text-gray-500">
                    <p>No recent calls</p>
                  </div>
                  <button className="btn btn-sm btn-outline mt-2">View History</button>
                </div>
              </div>
            </div>
          </div>

          {/* Call Interface */}
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h2 className="text-xl font-bold text-zippcall-blue mb-4">Make a Call</h2>
            
            {/* Phone UI Container */}
            <div className="bg-gray-50 rounded-xl p-5 max-w-sm mx-auto mb-6">
              {/* Phone Display with Country Selector */}
              <PhoneInput
                value={phoneNumber}
                onChange={setPhoneNumber}
                selectedCountry={selectedCountry}
                onCountryChange={setSelectedCountry}
                className="mb-4"
              />
              
              {/* Dial Pad - Skype-like */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((digit) => {
                  if (digit === 0) {
                    return (
                      <button
                        key={digit}
                        onMouseDown={handleZeroButtonDown}
                        onTouchStart={handleZeroButtonDown}
                        onMouseUp={handleZeroButtonUp}
                        onMouseLeave={handleZeroButtonUp}
                        onTouchEnd={handleZeroButtonUp}
                        className="btn btn-circle h-16 w-16 mx-auto bg-white hover:bg-zippcall-light-blue/20 text-2xl font-medium border-gray-200 shadow-sm text-zippcall-blue"
                      >
                        {digit}
                        <span className="text-xs block">+</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={digit}
                      onClick={() => handleDigitClick(digit.toString())}
                      className="btn btn-circle h-16 w-16 mx-auto bg-white hover:bg-zippcall-light-blue/20 text-2xl font-medium border-gray-200 shadow-sm text-zippcall-blue"
                    >
                      {digit}
                    </button>
                  );
                })}
              </div>
              
              {/* Call Control Buttons */}
              <div className="flex justify-between items-center">
                <button
                  onClick={handleDeleteDigit}
                  className="btn btn-circle bg-gray-100 hover:bg-gray-200 border-0"
                  disabled={!phoneNumber || isCalling || callInProgress}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12 12 14.25m-2.58 4.92-6.374-6.375a1.125 1.125 0 0 1 0-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33Z" />
                  </svg>
                </button>
                
                <button
                  onClick={handleCall}
                  className={`btn btn-circle h-16 w-16 ${
                    callInProgress 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  } border-0`}
                  disabled={!phoneNumber || isCalling}
                >
                  {isCalling ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : callInProgress ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                  )}
                </button>
                
                <button
                  className="btn btn-circle bg-gray-100 hover:bg-gray-200 border-0"
                  onClick={() => setPhoneNumber('')}
                  disabled={!phoneNumber || isCalling || callInProgress}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Call Status */}
            {isCalling && (
              <div className="text-center mb-4">
                <p className="text-sm font-medium text-zippcall-blue">
                  Calling {selectedCountry.code !== 'NONE' ? selectedCountry.dial_code + ' ' + phoneNumber : phoneNumber}...
                </p>
                {callDetails?.from && (
                  <p className="text-xs text-gray-500 mt-1">
                    From: {callDetails.from}
                  </p>
                )}
              </div>
            )}
            
            {callInProgress && (
              <div className="text-center mb-4">
                <p className="text-sm font-medium text-green-600 animate-pulse">
                  Call in progress with {selectedCountry.code !== 'NONE' ? selectedCountry.dial_code + ' ' + phoneNumber : phoneNumber}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Call quality: Excellent
                </p>
                {callDetails?.callSid && (
                  <p className="text-xs text-gray-400 mt-1">
                    Call ID: {callDetails.callSid.substring(0, 8)}...
                  </p>
                )}
              </div>
            )}
            
            {callStatus === 'failed' && (
              <div className="text-center mb-4">
                <p className="text-sm font-medium text-red-600">
                  Call failed. Please try again later.
                </p>
              </div>
            )}
            
            {/* Rates Information */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-md font-semibold text-zippcall-blue mb-2">Call Rates</h3>
              {selectedCountry.code === 'NONE' ? (
                <p className="text-sm text-gray-600">
                  Please finish entering the country code to see rates.
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  Calls to {selectedCountry.name}: <span className="font-semibold">${(Math.random() * 0.1 + 0.02).toFixed(3)}/min</span>
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Rates are calculated based on your current credit balance.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 