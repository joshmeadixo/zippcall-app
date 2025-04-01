'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function AccountDetailsCard() {
  const { user, loading: authLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Don't render card if loading or no user
  if (authLoading || !user) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Account Details</h2>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="text-blue-500 hover:text-blue-700 text-sm font-medium focus:outline-none"
            aria-expanded={isOpen}
            aria-controls="account-details-card-content"
          >
            {isOpen ? 'Hide' : 'Show'}
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`inline-block h-4 w-4 ml-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        
        {/* Collapsible Content */}
        {isOpen && (
          <div id="account-details-card-content" className="pt-2 border-t border-gray-100">
            <dl className="text-sm">
                <dt className="text-gray-500">Email:</dt>
                <dd className="text-gray-800 font-medium mb-2">{user.email || 'N/A'}</dd>
                
                <dt className="text-gray-500">User ID:</dt>
                <dd className="text-gray-800 font-mono text-xs break-all">{user.uid}</dd>
                
                {/* Add other details here if needed later */}
            </dl>
            {/* Add Sign Out button here too? Or other account links */} 
          </div>
        )}
    </div>
  );
} 