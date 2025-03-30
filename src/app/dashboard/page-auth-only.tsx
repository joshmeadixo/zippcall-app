'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import VoiceCall from '@/components/VoiceCall';
import CallHistory, { CallHistoryEntry } from '@/components/CallHistory';

export default function DashboardAuthOnly() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      // If not authenticated, redirect to login page
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin w-8 h-8 border-t-2 border-l-2 border-blue-500 rounded-full"></div>
        <p className="mt-4 text-blue-500">Loading your account...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in the useEffect
  }

  const handleCallHistoryUpdate = (newHistory: CallHistoryEntry[]) => {
    setCallHistory(newHistory);
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
            <h1 className="text-2xl font-bold text-blue-500">ZippCall</h1>
          </div>
          
          <div className="flex items-center">
            <span className="mr-4 text-gray-700">
              {user.email || 'User'}
            </span>
            <button 
              onClick={() => signOut()}
              className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column - Phone Card */}
          <div>
            <VoiceCall 
              userId={user.uid} 
              title="Phone" 
              hideHistory={true}
              onHistoryUpdate={handleCallHistoryUpdate}
            />
          </div>
          
          {/* Middle and Right Columns */}
          <div className="md:col-span-2 space-y-6">
            {/* Credits Card - Top Right */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Credits</h2>
                <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded-md text-sm">
                  Add Credits
                </button>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Available Balance</p>
                  <p className="text-2xl font-bold text-blue-600">$25.00</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Rate</p>
                  <p className="text-md font-medium">$0.01/min</p>
                </div>
              </div>
            </div>
            
            {/* Call History - Bottom Right */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-xl font-semibold mb-4">Call History</h2>
              {callHistory.length > 0 ? (
                <CallHistory 
                  calls={callHistory}
                  onCallClick={() => {}} 
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No call history yet</p>
                  <p className="text-sm mt-2">Start making calls to see your history here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 