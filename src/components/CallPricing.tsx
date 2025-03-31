import React, { useState, useEffect } from 'react';
import { PhoneNumberPriceResponse } from '@/types/pricing';
import { calculateCallCost, formatPrice } from '@/lib/pricing/pricing-engine';

interface CallPricingProps {
  phoneNumber: string;
  isCallActive: boolean;
  callStartTime?: number | null;
  callDuration?: number;
  showPlaceholder?: boolean;
  onPricingUpdate?: (price: number, cost: number) => void;
}

export default function CallPricing({
  phoneNumber,
  isCallActive,
  callStartTime,
  callDuration,
  showPlaceholder = false,
  onPricingUpdate
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
  
  if (isLoading) {
    return (
      <div className="text-center py-2 text-sm text-gray-500">
        <div className="inline-block animate-pulse">
          Calculating price...
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-2 text-sm text-red-500">
        {error}
      </div>
    );
  }
  
  // Show placeholder if no pricing data is available but placeholder is enabled
  if (!pricing) {
    if (showPlaceholder) {
      return (
        <div className="call-pricing bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm">
          <div className="text-center py-1 text-blue-700">
            Enter a phone number to see pricing
          </div>
        </div>
      );
    }
    return null;
  }
  
  // Format duration for display (MM:SS)
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="call-pricing bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm">
      <div className="flex justify-between items-center">
        <span className="font-medium text-blue-800">
          Rate:
        </span>
        <span className="text-blue-700">
          {formatPrice(pricing.finalPrice)} / min
        </span>
      </div>
      
      {isCallActive && (
        <>
          <div className="border-t border-blue-100 my-2"></div>
          
          <div className="flex justify-between items-center">
            <span className="font-medium text-blue-800">
              Duration:
            </span>
            <span className="text-blue-700 tabular-nums">
              {formatDuration(durationSeconds)}
            </span>
          </div>
          
          <div className="flex justify-between items-center mt-1">
            <span className="font-medium text-blue-800">
              Current Cost:
            </span>
            <span className="text-blue-700 font-bold tabular-nums">
              {formatPrice(currentCost)}
            </span>
          </div>
        </>
      )}
      
      <div className="mt-2 text-xs text-blue-600">
        Calls are billed per {pricing.billingIncrement / 60} minute increments
      </div>
    </div>
  );
} 