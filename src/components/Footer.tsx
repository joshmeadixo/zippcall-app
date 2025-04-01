'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
// Import Firestore functions
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
// Remove unused imports
// import { getIdTokenResult } from 'firebase/auth';

export default function Footer() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true); 
  // Remove Account section state
  // const [isAccountSectionOpen, setIsAccountSectionOpen] = useState(false);

  // console.log(`[Footer Firestore Check] Component executing. authLoading=${authLoading}, user=${user ? user.uid : 'null'}`);

  useEffect(() => {
    // console.log(`[Footer Firestore Check] useEffect triggered. User: ${user ? user.uid : 'null'}`);
    
    const checkAdminFirestore = async () => {
      if (!user) { 
        // console.log("[Footer Firestore Check] No user, setting isAdmin false.");
        setIsAdmin(false);
        setIsCheckingAdmin(false);
        return;
      }
      
      // console.log(`[Footer Firestore Check] Running checkAdminFirestore for user: ${user.uid}`);
      setIsCheckingAdmin(true);
      try {
        // Check if user is an admin by looking up their user document in Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists() && userDocSnap.data().isAdmin === true) {
          // console.log(`[Footer Firestore Check] User ${user.uid} IS admin based on Firestore doc.`);
          setIsAdmin(true);
        } else {
          // console.log(`[Footer Firestore Check] User ${user.uid} is NOT admin based on Firestore doc (exists: ${userDocSnap.exists()}, data: ${JSON.stringify(userDocSnap.data())}).`);
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("[Footer Firestore Check] Error reading user document:", error);
        setIsAdmin(false);
      } finally {
        // console.log("[Footer Firestore Check] Setting isCheckingAdmin to false");
        setIsCheckingAdmin(false);
      }
    };

    // Run check only when user is available and auth is done loading
    if (!authLoading && user) {
      checkAdminFirestore();
    } else if (!authLoading && !user) {
        // If auth is done and still no user, stop checking
        setIsAdmin(false);
        setIsCheckingAdmin(false);
    }

  }, [user, authLoading]); // Depend on user and authLoading

  if (authLoading || !user) {
    // console.log("[Footer Firestore Check] Rendering null (authLoading or no user)");
    return null;
  }
  
  // Only render the link if the check is complete AND user is admin
  const showAdminLink = !isCheckingAdmin && isAdmin; 

  // console.log(`[Footer Firestore Check] Rendering footer element. isAdmin=${isAdmin}, isCheckingAdmin=${isCheckingAdmin}, showAdminLink=${showAdminLink}`);

  return (
    <footer className="w-full py-4 px-4 mt-auto border-t border-gray-200 bg-gray-50">
      <div className="container mx-auto text-center text-xs space-y-1"> 
        {/* Copyright Line */}
        {!isCheckingAdmin && (
           <div> 
             <span className="text-gray-400">&copy; {new Date().getFullYear()} ZippCall</span>
           </div>
        )}
        
        {/* Admin Link Line (Conditional) */}
        {showAdminLink && (
           <div> 
             <Link href="/admin" legacyBehavior>
               <a className="text-gray-500 hover:text-gray-700 transition-colors">
                 Admin Dashboard
               </a>
             </Link>
           </div>
        )}
        
        {/* Remove Account Toggle Button and Section */}
      </div>
    </footer>
  );
}