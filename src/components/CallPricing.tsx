import React, { useState, useEffect } from 'react';
import { PhoneNumberPriceResponse } from '@/types/pricing';
import { calculateCallCost, formatPrice } from '@/lib/pricing/pricing-engine';

interface CallPricingProps {
  phoneNumber: string;
  isCallActive: boolean;
  callStartTime?: number | null;
  callDuration?: number;
  onPricingUpdate?: (price: number, cost: number) => void;
  userBalance: number | null;
  isLoadingBalance: boolean;
}

// Define minimum balance threshold here as well (or import from a shared config)
const MIN_BALANCE_THRESHOLD = 0.15;

export default function CallPricing({
  phoneNumber,
  isCallActive,
  callStartTime,
  callDuration,
  onPricingUpdate,
  userBalance,
  isLoadingBalance,
}: CallPricingProps) {
  const [pricing, setPricing] = useState<PhoneNumberPriceResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentCost, setCurrentCost] = useState<number>(0);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  
  // Fetch pricing data for the phone number
  useEffect(() => {
    if (!phoneNumber) {
      setPricing(null);
      return;
    }
    
    const fetchPricing = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/pricing?phoneNumber=${encodeURIComponent(phoneNumber)}`);
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setPricing(data);
      } catch (err) {
        console.error('Error fetching pricing:', err);
        setError('Unable to fetch pricing information');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPricing();
  }, [phoneNumber]);
  
  // Update cost during an active call
  useEffect(() => {
    if (!isCallActive || !pricing || !callStartTime) {
      setCurrentCost(0);
      setDurationSeconds(0);
      return;
    }
    
    // If this is an unsupported country, don't calculate cost
    if (pricing.isUnsupported) {
      return;
    }

    // If call duration is provided directly, use it
    if (callDuration !== undefined) {
      setDurationSeconds(callDuration);
      const cost = calculateCallCost(
        pricing.finalPrice,
        callDuration,
        pricing.billingIncrement
      );
      setCurrentCost(cost);
      
      // Report pricing updates to parent
      if (onPricingUpdate) {
        onPricingUpdate(pricing.finalPrice, cost);
      }
      
      return;
    }
    
    // Otherwise, calculate duration based on start time
    const intervalId = setInterval(() => {
      const now = Date.now();
      const duration = Math.floor((now - callStartTime) / 1000);
      
      setDurationSeconds(duration);
      
      // Calculate the current cost
      const cost = calculateCallCost(
        pricing.finalPrice,
        duration,
        pricing.billingIncrement
      );
      
      setCurrentCost(cost);
      
      // Report pricing updates to parent
      if (onPricingUpdate) {
        onPricingUpdate(pricing.finalPrice, cost);
      }
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [isCallActive, pricing, callStartTime, callDuration, onPricingUpdate]);
  
  // --- Helper to render Rate Info --- 
  const renderRateInfo = () => {
    if (!pricing) return null;

    // Display message for unsupported countries
    if (pricing.isUnsupported) {
      return (
        <div className="text-sm text-orange-600">
          ZippCall does not support calls to {pricing.countryName} yet, we are working to add this soon
        </div>
      );
    }

    return (
      <div className="text-sm text-gray-600">
        Rate: <span className="font-semibold">{formatPrice(pricing.finalPrice)}</span> / min
        {pricing.billingIncrement !== 60 && 
          <span className="text-xs text-gray-500 ml-1">(billed per {pricing.billingIncrement}s)</span>}
      </div>
    );
  };
  
  // --- Re-add formatDuration helper function ---
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // --- RENDER LOGIC --- 
  
  // 1. Handle Loading Pricing State
  if (isLoading) {
    return (
      <div className="text-center py-2 text-sm text-gray-500">
        <div className="inline-block animate-pulse">
          Calculating price...
        </div>
      </div>
    );
  }
  
  // 2. Handle Pricing Error State
  if (error) {
    return (
      <div className="text-center py-2 text-sm text-red-500">
        {error}
      </div>
    );
  }

  // 3. Handle No Pricing Info State (If API succeeded but returned no data)
  if (!isLoading && !error && !pricing) {
    return (
      <div className="text-center py-2 text-sm text-gray-500">
        Pricing information unavailable for this number.
      </div>
    );
  }

  // --- At this point, we assume we have pricing info (`pricing` is not null) --- 

  // 4. Handle Loading Balance State
  if (isLoadingBalance) {
      return (
        <div className="text-center py-2 text-sm text-gray-500">
          <div className="inline-block animate-pulse">
            Checking balance...
          </div>
          {/* Optionally show rate dimmed while checking balance? */} 
          {/* <div className="opacity-50 mt-1">{renderRateInfo()}</div> */}
        </div>
      );
  }

  // --- At this point, pricing and balance are loaded --- 
  
  // 5. Handle Low Balance State 
  if (userBalance !== null && userBalance <= MIN_BALANCE_THRESHOLD) {
    return (
      <div className="text-center py-2 px-3 text-sm bg-orange-100 text-orange-700 rounded-md">
        <p className="font-medium">Low balance! Please add funds to make a call.</p>
        {/* Show rate info below the warning */}
        <div className="mt-1 border-t border-orange-200 pt-1"> 
          {renderRateInfo()}
        </div>
      </div>
    );
  }
  
  // 6. Display Pricing/Cost (Default Success State - balance is sufficient)
  return (
    <div className="text-center py-2 text-sm text-gray-600 bg-gray-50 rounded-md">
      {isCallActive ? (
        // Check for pricing before accessing properties
        pricing ? (
          pricing.isUnsupported ? (
            <span className="text-orange-600">
              Calling to {pricing.countryName} is not supported yet
            </span>
          ) : (
            <span>
              Cost: <span className="font-semibold">{formatPrice(currentCost)}</span> 
              ({formatPrice(pricing.finalPrice)}/min, {formatDuration(durationSeconds)})
            </span>
          )
        ) : (
          // Fallback if pricing is unexpectedly null during active call
          <span>Calculating cost...</span>
        )
      ) : (
        // Show rate when idle (and balance is sufficient)
        renderRateInfo()
      )}
    </div>
  );
} 