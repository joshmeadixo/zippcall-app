'use client';

import React, { useState, useEffect } from 'react';
import { CountryPricingCache, TwilioPriceData } from '@/types/pricing';
import { getCountryPricing } from '@/lib/pricing/pricing-db';
import { formatPrice } from '@/lib/pricing/pricing-engine';
import MobileCardView from '@/components/admin/MobileCardView';

interface PricingDashboardProps {
  pricingData: Record<string, TwilioPriceData>;
  topWidget?: React.ReactNode;
}

export default function PricingDashboard({ pricingData: initialPricingData, topWidget }: PricingDashboardProps) {
  const [pricingData, setPricingData] = useState<CountryPricingCache | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<string>('countryName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  useEffect(() => {
    // If initialPricingData has content, use it instead of loading from API
    if (initialPricingData && Object.keys(initialPricingData).length > 0) {
      // Convert the initial data to the expected format
      setPricingData({
        version: 1,
        lastUpdated: new Date(),
        data: initialPricingData
      });
      setIsLoading(false);
    } else {
      // Otherwise load from API
      loadPricingData();
    }
  }, [initialPricingData]);
  
  const loadPricingData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getCountryPricing();
      
      // If data is null or empty, show a helpful error message instead of infinite loading
      if (!data || !data.data || Object.keys(data.data).length === 0) {
        console.log('No pricing data found in database');
        setError('No pricing data found. Please use the CSV Import above to upload pricing data.');
        setPricingData({
          version: 1,
          lastUpdated: new Date(),
          data: {}
        });
      } else {
        setPricingData(data);
      }
    } catch (err) {
      console.error('Error loading pricing data:', err);
      setError('Failed to load pricing data. Check if Firestore is properly configured and the pricing collection exists.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle sort direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Format pricing data into a displayable array
  const formatPricingForDisplay = () => {
    if (!pricingData || !pricingData.data) {
      return [];
    }
    
    // Get markup config for calculating our prices
    const markupConfig = {
      defaultMarkup: 100,
      minimumMarkup: 100,
      minimumFinalPrice: 0.15,
      countrySpecificMarkups: {} as Record<string, number>
    };
    
    // Convert object to array
    const pricingArray = Object.values(pricingData.data).map(item => {
      // Calculate our price
      const basePrice = isNaN(item.basePrice) ? 0 : item.basePrice;
      const markup = markupConfig.countrySpecificMarkups[item.countryCode] || markupConfig.defaultMarkup;
      const markupAmount = basePrice * (markup / 100);
      let ourPrice = basePrice + markupAmount;
      
      // Ensure minimum price
      ourPrice = Math.max(ourPrice, markupConfig.minimumFinalPrice);
      
      return {
        countryCode: item.countryCode,
        countryName: item.countryName,
        basePrice: basePrice,
        ourPrice: ourPrice,
        currency: 'USD', // Always display as USD
        lastUpdated: item.lastUpdated,
      };
    });
    
    // Apply search filter
    const filteredArray = pricingArray.filter(item => {
      const searchLower = searchQuery.toLowerCase();
      return (
        item.countryCode.toLowerCase().includes(searchLower) ||
        item.countryName.toLowerCase().includes(searchLower)
      );
    });
    
    // Apply sorting
    const sortedArray = [...filteredArray].sort((a, b) => {
      if (sortField === 'basePrice') {
        const priceA = isNaN(a.basePrice) ? 0 : a.basePrice;
        const priceB = isNaN(b.basePrice) ? 0 : b.basePrice;
        return sortDirection === 'asc' 
          ? priceA - priceB 
          : priceB - priceA;
      } else if (sortField === 'ourPrice') {
        const priceA = isNaN(a.ourPrice) ? 0 : a.ourPrice;
        const priceB = isNaN(b.ourPrice) ? 0 : b.ourPrice;
        return sortDirection === 'asc' 
          ? priceA - priceB 
          : priceB - priceA;
      } else if (sortField === 'lastUpdated') {
        return sortDirection === 'asc'
          ? new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()
          : new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      } else {
        // Sort string fields
        const valA = a[sortField as keyof typeof a] as string;
        const valB = b[sortField as keyof typeof b] as string;
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }
    });
    
    return sortedArray;
  };
  
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };
  
  // Update filtered countries when search query changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    
    if (!query) {
      return;
    }
    
    // Get all country codes and names from pricing data (safely)
    const allCountryCodes = pricingData?.data ? Object.keys(pricingData.data) : [];
    
    // Filter countries based on search
    const filtered = allCountryCodes.filter(code => {
      // Check if both pricingData and its data property exist
      if (!pricingData?.data) return false;
      
      const country = pricingData.data[code];
      
      // Check if country code or name matches the search query
      return (
        code.toLowerCase().includes(query) || 
        (country.countryName && country.countryName.toLowerCase().includes(query))
      );
    });
    
    // Sort by relevance (exact matches first, then starts with, then includes)
    filtered.sort((a, b) => {
      // Safely access country names
      const aName = (pricingData?.data?.[a]?.countryName || '').toLowerCase();
      const bName = (pricingData?.data?.[b]?.countryName || '').toLowerCase();
      
      // Exact matches come first
      if (a.toLowerCase() === query) return -1;
      if (b.toLowerCase() === query) return 1;
      if (aName === query) return -1;
      if (bName === query) return 1;
      
      // Then "starts with" matches
      if (a.toLowerCase().startsWith(query)) return -1;
      if (b.toLowerCase().startsWith(query)) return 1;
      if (aName.startsWith(query)) return -1;
      if (bName.startsWith(query)) return 1;
      
      // Then alphabetical order
      return a.localeCompare(b);
    });
    
  };
  
  if (isLoading && !pricingData) {
    return (
      <div className="p-6 bg-white shadow rounded-lg">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      {topWidget && <div className="mb-6">{topWidget}</div>}

      <div className="p-6 bg-white shadow rounded-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
          <h2 className="text-xl font-semibold text-gray-800">Voice Pricing Data</h2>
          
          <div className="flex items-center gap-3">
            {pricingData && (
              <span className="text-sm text-gray-500">
                Last Updated: {formatDate(pricingData.lastUpdated)}
              </span>
            )}
          </div>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-600 rounded-md">
            {error}
          </div>
        )}
        
        {/* Search and Filter */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by country name or code..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  onClick={() => handleSort('countryCode')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Country Code
                  {sortField === 'countryCode' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  onClick={() => handleSort('countryName')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Country Name
                  {sortField === 'countryName' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  onClick={() => handleSort('basePrice')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Base Price
                  {sortField === 'basePrice' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  onClick={() => handleSort('ourPrice')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Our Price
                  {sortField === 'ourPrice' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  onClick={() => handleSort('lastUpdated')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Last Updated
                  {sortField === 'lastUpdated' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {formatPricingForDisplay().length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    {searchQuery ? 'No countries match your search.' : 'No pricing data available.'}
                  </td>
                </tr>
              ) : (
                formatPricingForDisplay().map((item) => (
                  <tr key={item.countryCode} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.countryCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.countryName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatPrice(item.basePrice, item.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatPrice(item.ourPrice, item.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(item.lastUpdated)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card view */}
        <div className="md:hidden">
          {formatPricingForDisplay().length === 0 ? (
            <div className="bg-white rounded-lg shadow p-4 text-center text-gray-500">
              {searchQuery ? 'No countries match your search.' : 'No pricing data available.'}
            </div>
          ) : (
            <MobileCardView 
              items={formatPricingForDisplay().map((item) => ({
                id: item.countryCode,
                fields: [
                  { label: 'Country Code', value: item.countryCode },
                  { label: 'Country Name', value: item.countryName },
                  { label: 'Base Price', value: formatPrice(item.basePrice, item.currency) },
                  { label: 'Our Price', value: formatPrice(item.ourPrice, item.currency) },
                  { label: 'Last Updated', value: formatDate(item.lastUpdated) }
                ]
              }))}
            />
          )}
        </div>
        
        {/* Stats */}
        <div className="mt-4 p-3 bg-blue-50 rounded-md text-sm text-blue-700">
          <p className="text-center md:text-left">
            Showing {formatPricingForDisplay().length} countries {searchQuery && `matching "${searchQuery}"`}
            {pricingData?.data && ` out of ${Object.keys(pricingData.data).length} total countries`}
          </p>
        </div>
      </div>
    </div>
  );
} 