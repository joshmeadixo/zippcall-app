'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AdminAccessOnlyProps {
  children: ReactNode;
}

export default function AdminAccessOnly({ children }: AdminAccessOnlyProps) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const router = useRouter();
  
  useEffect(() => {
    const auth = getAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Check if user is an admin by looking up their user document
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().isAdmin === true) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
            router.push('/'); // Redirect non-admin users
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
          router.push('/'); // Redirect on error
        }
      } else {
        setIsAdmin(false);
        router.push('/login?redirect=/admin'); // Redirect to login
      }
    });
    
    return () => unsubscribe();
  }, [router]);
  
  if (isAdmin === null) {
    // Loading state
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin h-10 w-10 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }
  
  if (isAdmin === false) {
    // This will only briefly show before redirect
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }
  
  // User is admin
  return <>{children}</>;
} 