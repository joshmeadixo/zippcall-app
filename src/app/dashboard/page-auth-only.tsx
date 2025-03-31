'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import VoiceCall from '@/components/VoiceCall';
import CallHistory, { CallHistoryEntry } from '@/components/CallHistory';
import AdminNavLink from '@/components/AdminNavLink';
import { getUserCallHistory, deleteCallHistoryEntry } from '@/lib/call-history-db';

export default function DashboardAuthOnly() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  // Reference to the VoiceCall component
  const voiceCallRef = useRef<any>(null);

  useEffect(() => {
    if (!loading && !user) {
      // If not authenticated, redirect to login page
      router.push('/');
    }
  }, [user, loading, router]);

  // Load call history from Firestore when user is authenticated
  useEffect(() => {
    const loadCallHistory = async () => {
      if (user && user.uid) {
        try {
          setIsLoadingHistory(true);
          console.log(`[Dashboard] Loading call history for user ${user.uid}`);
          const history = await getUserCallHistory(user.uid);
          setCallHistory(history);
          console.log(`[Dashboard] Loaded ${history.length} call history entries from Firestore`);
        } catch (error) {
          console.error('[Dashboard] Error loading call history:', error);
        } finally {
          setIsLoadingHistory(false);
        }
      }
    };

    if (user) {
      loadCallHistory();
    }
  }, [user]);

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
    // We'll merge the local history with what we have from Firestore
    // The most recent call (which just ended) will be at the beginning of newHistory
    // We'll take that and add it to our existing history
    if (newHistory.length > 0) {
      const mostRecentCall = newHistory[0];
      // Check if this call is already in our history
      const callExists = callHistory.some(call => call.id === mostRecentCall.id);
      if (!callExists) {
        // Add the new call to the beginning of our history
        setCallHistory([mostRecentCall, ...callHistory]);
      }
    }
  };

  // Handle click on a call history entry
  const handleHistoryItemClick = (phoneNumber: string) => {
    console.log(`[Dashboard] Call history item clicked: ${phoneNumber}`);
    
    // If we have a reference to the VoiceCall component, use its method
    if (voiceCallRef.current && typeof voiceCallRef.current.callNumber === 'function') {
      voiceCallRef.current.callNumber(phoneNumber);
    } else {
      console.error('[Dashboard] VoiceCall reference not available');
    }
  };
  
  // Handle deletion of a call history entry
  const handleHistoryItemDelete = async (callId: string) => {
    console.log(`[Dashboard] Deleting call history entry: ${callId}`);
    
    if (!user || !user.uid) {
      console.error('[Dashboard] Cannot delete call history: User not authenticated');
      return;
    }
    
    try {
      // First update the local state
      const updatedHistory = callHistory.filter(call => call.id !== callId);
      setCallHistory(updatedHistory);
      
      // Then delete from Firestore
      const success = await deleteCallHistoryEntry(callId, user.uid);
      
      if (success) {
        console.log(`[Dashboard] Successfully deleted call history entry: ${callId}`);
      } else {
        console.error(`[Dashboard] Failed to delete call history entry: ${callId}`);
        // If failed, revert the local state update by reloading the call history
        const history = await getUserCallHistory(user.uid);
        setCallHistory(history);
      }
    } catch (error) {
      console.error('[Dashboard] Error deleting call history entry:', error);
    }
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
          
          <div className="flex items-center space-x-4">
            <AdminNavLink />
            <span className="text-gray-700">
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Left Column - Phone Card */}
          <div className="md:col-span-2">
            <VoiceCall 
              ref={voiceCallRef}
              userId={user.uid} 
              title="Phone" 
              hideHistory={true}
              onHistoryUpdate={handleCallHistoryUpdate}
            />
          </div>
          
          {/* Middle and Right Columns */}
          <div className="md:col-span-3 space-y-6">
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
              {isLoadingHistory ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-6 h-6 border-t-2 border-l-2 border-blue-500 rounded-full mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading your call history...</p>
                </div>
              ) : callHistory.length > 0 ? (
                <CallHistory 
                  calls={callHistory}
                  onCallClick={handleHistoryItemClick}
                  onDeleteClick={handleHistoryItemDelete}
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