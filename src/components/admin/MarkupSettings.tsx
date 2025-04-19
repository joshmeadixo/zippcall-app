'use client';

import React, { useState, useEffect } from 'react';
import { MarkupConfig } from '@/types/pricing';
import { getMarkupConfig } from '@/lib/pricing/pricing-db-client';

export default function MarkupSettings() {
  const [markupConfig, setMarkupConfig] = useState<MarkupConfig>({
    defaultMarkup: 30,
    countrySpecificMarkups: {},
    minimumMarkup: 15,
    minimumFinalPrice: 0.01
  });
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // New country-specific markup form
  const [newCountryCode, setNewCountryCode] = useState<string>('');
  const [newMarkupPercentage, setNewMarkupPercentage] = useState<number>(30);
  
  // Load markup config on mount
  useEffect(() => {
    loadMarkupConfig();
  }, []);
  
  // Function to load markup config
  const loadMarkupConfig = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const config = await getMarkupConfig();
      setMarkupConfig(config);
    } catch (err) {
      console.error('Error loading markup config:', err);
      setError('Failed to load markup configuration');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to save markup config
  const saveSettings = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const adminToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN;
      if (!adminToken) {
        throw new Error('Admin token not configured in .env.local');
      }

      const response = await fetch('/api/admin/pricing/markup-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(markupConfig)
      });

      if (!response.ok) {
        let errorMsg = 'Failed to save markup configuration';
        try {
           const errorData = await response.json();
           errorMsg = errorData.error || errorMsg;
        } catch { /* Ignore parsing error */ }
        throw new Error(errorMsg);
      }

      setSuccess('Markup settings saved successfully');
      
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error saving markup config:', err);
      setError('Failed to save markup configuration');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle form changes
  const handleDefaultMarkupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      setMarkupConfig({
        ...markupConfig,
        defaultMarkup: value
      });
    }
  };
  
  const handleMinimumMarkupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      setMarkupConfig({
        ...markupConfig,
        minimumMarkup: value
      });
    }
  };
  
  const handleMinimumFinalPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      setMarkupConfig({
        ...markupConfig,
        minimumFinalPrice: value
      });
    }
  };
  
  // Add a new country-specific markup
  const addCountryMarkup = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCountryCode || newCountryCode.length !== 2) {
      setError('Please enter a valid 2-letter country code');
      return;
    }
    
    const countryCode = newCountryCode.toUpperCase();
    
    setMarkupConfig({
      ...markupConfig,
      countrySpecificMarkups: {
        ...markupConfig.countrySpecificMarkups,
        [countryCode]: newMarkupPercentage
      }
    });
    
    // Reset form
    setNewCountryCode('');
    setNewMarkupPercentage(30);
  };
  
  // Remove a country-specific markup
  const removeCountryMarkup = (countryCode: string) => {
    const updatedMarkups = { ...markupConfig.countrySpecificMarkups };
    delete updatedMarkups[countryCode];
    
    setMarkupConfig({
      ...markupConfig,
      countrySpecificMarkups: updatedMarkups
    });
  };
  
  if (isLoading) {
    return (
      <div className="p-6 bg-white shadow rounded-lg">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 bg-white shadow rounded-lg">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Markup Settings</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-600 rounded-md">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-600 rounded-md">
          {success}
        </div>
      )}
      
      <div className="space-y-6">
        {/* General Markup Settings */}
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-3">General Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="defaultMarkup" className="block text-sm font-medium text-gray-700 mb-1">
                Default Markup Percentage
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type="number"
                  id="defaultMarkup"
                  value={markupConfig.defaultMarkup}
                  onChange={handleDefaultMarkupChange}
                  min="0"
                  step="0.1"
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">%</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Applied to all countries unless overridden
              </p>
            </div>
            
            <div>
              <label htmlFor="minimumMarkup" className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Markup Percentage
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type="number"
                  id="minimumMarkup"
                  value={markupConfig.minimumMarkup}
                  onChange={handleMinimumMarkupChange}
                  min="0"
                  step="0.1"
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">%</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Lowest markup percentage allowed
              </p>
            </div>
            
            <div>
              <label htmlFor="minimumFinalPrice" className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Final Price
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  id="minimumFinalPrice"
                  value={markupConfig.minimumFinalPrice}
                  onChange={handleMinimumFinalPriceChange}
                  min="0"
                  step="0.0001"
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">/min</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Lowest per-minute price regardless of base price
              </p>
            </div>
          </div>
        </div>
        
        {/* Country-Specific Markups */}
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-3">Country-Specific Markups</h3>
          
          {/* Add new country form */}
          <form onSubmit={addCountryMarkup} className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="countryCode" className="block text-sm font-medium text-gray-700 mb-1">
                  Country Code
                </label>
                <input
                  type="text"
                  id="countryCode"
                  value={newCountryCode}
                  onChange={e => setNewCountryCode(e.target.value)}
                  placeholder="US"
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  maxLength={2}
                />
              </div>
              
              <div>
                <label htmlFor="markupPercentage" className="block text-sm font-medium text-gray-700 mb-1">
                  Markup Percentage
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="number"
                    id="markupPercentage"
                    value={newMarkupPercentage}
                    onChange={e => setNewMarkupPercentage(parseFloat(e.target.value))}
                    min="0"
                    step="0.1"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Add Country Markup
                </button>
              </div>
            </div>
          </form>
          
          {/* Country markups list */}
          {Object.keys(markupConfig.countrySpecificMarkups).length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Country Code
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Markup Percentage
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(markupConfig.countrySpecificMarkups).map(([code, markup]) => (
                    <tr key={code}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {markup}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => removeCountryMarkup(code)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-gray-500">
              No country-specific markups configured yet.
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={saveSettings}
          disabled={isSaving}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
} 