import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { User } from 'firebase/auth';

// Constants for Loops API
const LOOPS_API_KEY = process.env.LOOPS_API_KEY || '';
const LOOPS_CONTACT_CREATE_ENDPOINT = 'https://app.loops.so/api/v1/contacts/create';

/**
 * Ensures that a user document exists in Firestore for the given user
 * If the document doesn't exist, it creates one with default values
 * @param user Firebase Auth user object
 */
export async function ensureUserDocument(user: User): Promise<void> {
  console.log(`[ensureUserDocument] Starting for user ${user?.uid || 'unknown'}`);
  
  if (!user || !user.uid) {
    console.error('[ensureUserDocument] Invalid user provided to ensureUserDocument');
    return;
  }
  
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.log(`[ensureUserDocument] Creating new user document for ${user.uid}`);
      // Create a new user document with default values
      const userData = {
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        createdAt: new Date(),
        lastLogin: new Date(),
        isAdmin: false, // Default to non-admin
        phoneNumber: user.phoneNumber || '',
        balance: 0, // Initialize balance to 0
      };
      await setDoc(userRef, userData);
      console.log(`[ensureUserDocument] Successfully created new user document for ${user.email}`);

      // --- Trigger Loops Contact Creation directly --- 
      if (user.email) { // Only proceed if email exists
        console.log(`[ensureUserDocument] About to call Loops sync API for new user ${user.uid} with email ${user.email}`);
        try {
          // Get base URL that works in both client and server contexts
          const baseUrl = typeof window !== 'undefined' 
            ? window.location.origin 
            : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
          
          // Call our API endpoint which runs server-side with environment variables
          const response = await fetch(`${baseUrl}/api/loops/sync-user`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: user.email,
              uid: user.uid
            }),
          });
          
          const result = await response.json();
          console.log(`[ensureUserDocument] Loops sync API response for ${user.uid}:`, result);
          
          if (response.ok && result.success) {
            console.log(`[ensureUserDocument] Successfully synced user to Loops via API for ${user.uid}`);
          } else {
            console.warn(`[ensureUserDocument] Failed to sync user to Loops via API for ${user.uid}: ${result.message || 'Unknown error'}`);
          }
        } catch (syncError) {
          console.error(`[ensureUserDocument] Exception calling Loops sync API for ${user.uid}:`, syncError);
        }
      } else {
        console.warn(`[ensureUserDocument] Cannot sync to Loops for UID ${user.uid} because email is missing.`);
      }
      // --- End Loops Trigger --- 

    } else {
      console.log(`[ensureUserDocument] User document exists, updating lastLogin for ${user.uid}`);
      // Update the lastLogin field
      await updateDoc(userRef, {
        lastLogin: new Date(),
      });
      console.log(`[ensureUserDocument] Successfully updated lastLogin for ${user.uid}`);
    }
  } catch (error) {
    console.error(`[ensureUserDocument] Error in ensureUserDocument for ${user.uid}:`, error);
    throw error; // Re-throw to allow calling code to handle the error
  }
}

/**
 * Synchronizes a user to Loops by calling the Loops API directly
 */
export async function syncUserToLoops(email: string, uid: string, firstName?: string, lastName?: string) {
  console.log(`[syncUserToLoops] Environment check - NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[syncUserToLoops] Starting sync for UID: ${uid}, Email: ${email}`);
  console.log(`[syncUserToLoops] API Key Present: ${Boolean(LOOPS_API_KEY)}, Length: ${LOOPS_API_KEY?.length || 0}`);
  console.log(`[syncUserToLoops] API endpoint: ${LOOPS_CONTACT_CREATE_ENDPOINT}`);

  // Validate API key
  if (!LOOPS_API_KEY) {
    console.error('[syncUserToLoops] Loops API key missing in environment variables');
    return false;
  }

  try {
    // Prepare payload for Loops API - match exact format from Loops docs
    const payload: {
      email: string;
      userId: string;
      source: string;
      firstName?: string;
      lastName?: string;
    } = {
      email: email,
      userId: uid,
      source: 'app_customer'
    };
    
    if (firstName) payload.firstName = firstName;
    if (lastName) payload.lastName = lastName;
    
    console.log('[syncUserToLoops] Payload:', JSON.stringify(payload));

    // Make the API call with exact headers from docs
    const response = await fetch(LOOPS_CONTACT_CREATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOOPS_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // Log full response details for debugging
    console.log('[syncUserToLoops] Response status:', response.status);
    console.log('[syncUserToLoops] Response status text:', response.statusText);
    
    let responseText;
    try {
      responseText = await response.text(); // Get raw text first
      console.log('[syncUserToLoops] Raw response:', responseText);
      
      // Try to parse as JSON if possible
      if (responseText && responseText.trim()) {
        const data = JSON.parse(responseText);
        console.log('[syncUserToLoops] Parsed response:', data);
        
        if (response.ok) {
          console.log('[syncUserToLoops] Successfully synced user to Loops');
          return true;
        }
      }
    } catch (parseError) {
      console.error('[syncUserToLoops] Error parsing response:', parseError);
    }

    // Handle error cases
    console.error('[syncUserToLoops] Failed to sync user to Loops. Status:', response.status);
    console.error('[syncUserToLoops] Response text:', responseText || 'No response body');
    return false;
  } catch (error) {
    console.error('[syncUserToLoops] Exception calling Loops API:', error);
    return false;
  }
}

/**
 * Checks if a user has admin privileges
 * @param userId The user ID to check
 * @returns True if user is an admin, false otherwise
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      return userData.isAdmin === true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
} 