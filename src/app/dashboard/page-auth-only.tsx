'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import VoiceCall from '@/components/VoiceCall';

export default function DashboardAuthOnly() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

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

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <header className="bg-white shadow-md rounded-lg mb-6">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-xl p-8">
              <h2 className="text-2xl font-bold text-center mb-6">Welcome to ZippCall</h2>
              
              <div className="text-center mb-8">
                <p className="text-gray-700">You&apos;re now signed in with:</p>
                <p className="font-medium mt-2">{user.email}</p>
                <p className="text-sm text-gray-500 mt-1">User ID: {user.uid.substring(0, 8)}...</p>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-700 mb-2">Authentication</h4>
                  <p className="text-sm text-gray-600">
                    Firebase authentication is working correctly. You can sign out and sign back in.
                  </p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-700 mb-2">Twilio Voice SDK</h4>
                  <p className="text-sm text-gray-600">
                    Use the call panel to make outbound calls or receive incoming calls.
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <VoiceCall userId={user.uid} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 