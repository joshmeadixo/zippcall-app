'use client';

import React, { useState, useEffect } from 'react';

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAmountSelected: (amount: number) => void; // Callback with the chosen amount
  isProcessing?: boolean; // Optional: Parent can indicate processing state
}

// Updated predefined amounts
const PREDEFINED_AMOUNTS = [5, 10, 15, 20, 30, 50];

export default function AddFundsModal({ 
  isOpen, 
  onClose, 
  onAmountSelected, 
  isProcessing = false // Default to not processing
}: AddFundsModalProps) {
  const [selectedPredefined, setSelectedPredefined] = useState<number | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedPredefined(null);
    }
  }, [isOpen]);

  const handlePredefinedClick = (amount: number) => {
    setSelectedPredefined(amount);
  };

  const handleConfirm = () => {
    if (selectedPredefined !== null) {
        console.log(`[AddFundsModal] Confirming amount: ${selectedPredefined}`);
        onAmountSelected(selectedPredefined);
    } else {
        // Although the button should be disabled, add a safeguard
        console.warn("[AddFundsModal] Confirm clicked without a selected amount.");
    }
  };

  if (!isOpen) {
    return null;
  }

  // Update confirm button disabled logic
  const isConfirmDisabled = isProcessing || selectedPredefined === null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
      <div className="relative mx-auto p-6 border w-full max-w-md shadow-lg rounded-md bg-white">
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Add Funds to Balance</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close modal" disabled={isProcessing}>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Predefined Amounts - Allow wrapping */}
        <div className="mb-6"> {/* Increased bottom margin */} 
          <p className="text-sm font-medium text-gray-700 mb-2">Select amount:</p>
          {/* Use flex-wrap to allow buttons onto next line if needed */}
          <div className="flex flex-wrap gap-3"> 
            {PREDEFINED_AMOUNTS.map(amount => (
              <button
                key={amount}
                onClick={() => handlePredefinedClick(amount)}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-md border transition-colors text-sm font-medium 
                  ${selectedPredefined === amount 
                    ? 'bg-blue-500 text-white border-blue-500' 
                    : 'bg-white text-blue-700 border-gray-300 hover:bg-gray-50'} 
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                ${amount}
              </button>
            ))}
          </div>
        </div>

        {/* Removed Custom Amount Input Section */}

        {/* Action Buttons */}
        <div className="flex justify-end items-center pt-4 border-t space-x-3">
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Update confirm button text */}
            {isProcessing ? 'Processing...' : (selectedPredefined ? `Confirm $${selectedPredefined}` : 'Select Amount') }
          </button>
        </div>
      </div>
    </div>
  );
} 