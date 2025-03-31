'use client';

import React, { useState, useEffect } from 'react';
import { PriceUpdateRecord } from '@/types/pricing';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatPrice } from '@/lib/pricing/pricing-engine';

export default function PriceChangeAlerts() {
  const [priceChanges, setPriceChanges] = useState<PriceUpdateRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<boolean>(false);
  
  useEffect(() => {
    loadPriceChanges();
  }, [showAll]);
  
  const loadPriceChanges = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const priceUpdatesRef = collection(db, 'price_updates');
      let priceQuery;
      
      if (showAll) {
        // Get all price updates sorted by timestamp
        priceQuery = query(
          priceUpdatesRef,
          orderBy('timestamp', 'desc'),
          limit(100)
        );
      } else {
        // Get only significant price changes
        priceQuery = query(
          priceUpdatesRef,
          where('isSignificant', '==', true),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
      }
      
      const querySnapshot = await getDocs(priceQuery);
      
      const updates: PriceUpdateRecord[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        updates.push({
          ...data,
          id: doc.id,
          timestamp: data.timestamp.toDate()
        } as PriceUpdateRecord);
      });
      
      setPriceChanges(updates);
    } catch (err) {
      console.error('Error loading price changes:', err);
      setError('Failed to load price change data');
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleString();
  };
  
  const getChangeColor = (percentChange: number) => {
    if (percentChange > 0) {
      return 'text-red-600'; // Price increase
    } else if (percentChange < 0) {
      return 'text-green-600'; // Price decrease
    }
    return 'text-gray-600'; // No change
  };
  
  if (isLoading && priceChanges.length === 0) {
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          Price Change {showAll ? 'History' : 'Alerts'}
        </h2>
        
        <button
          onClick={() => setShowAll(!showAll)}
          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
        >
          {showAll ? 'Show Significant Only' : 'Show All Changes'}
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-600 rounded-md">
          {error}
        </div>
      )}
      
      {priceChanges.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No price changes {!showAll && 'alerts'} found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Country
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Previous Price
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  New Price
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Change
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {priceChanges.map((change) => (
                <tr key={change.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(change.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {change.countryCode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatPrice(change.previousBasePrice, 'USD')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatPrice(change.newBasePrice, 'USD')}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getChangeColor(change.percentageChange)}`}>
                    {change.percentageChange > 0 ? '+' : ''}
                    {change.percentageChange.toFixed(2)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {change.isSignificant ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Significant
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        Minor
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-4 p-3 bg-blue-50 rounded-md text-sm text-blue-700">
        {showAll
          ? `Showing the last ${priceChanges.length} price changes`
          : `Showing ${priceChanges.length} significant price change alerts`}
      </div>
    </div>
  );
} 