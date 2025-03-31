import { App, getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let firebaseAdminApp: App | undefined;

/**
 * Initialize Firebase Admin if it hasn't been initialized already
 * 
 * @returns Firebase Admin app instance
 */
export function initializeFirebaseAdmin(): App {
  if (!getApps().length) {
    // If no apps have been initialized, create a new one
    
    // Check for required service account credentials - try both naming conventions
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    
    if (!projectId) {
      throw new Error('Firebase project ID is missing');
    }
    
    // If we have service account credentials, use them
    if (clientEmail && privateKey) {
      // Initialize Firebase Admin with service account credentials
      const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
      
      firebaseAdminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey
        })
      });
    } else {
      // Otherwise, just use application default credentials
      firebaseAdminApp = initializeApp({
        projectId
      }, 'admin');
    }
    
    console.log('Firebase Admin initialized');
    return firebaseAdminApp;
  }
  
  // Return the first app if already initialized
  return getApps()[0];
}

// Export functions instead of constant references to prevent initialization errors
export function getAdminAuth() {
  // Make sure Firebase is initialized
  initializeFirebaseAdmin();
  // Return the auth instance
  return getAuth();
}

export function getAdminFirestore() {
  // Make sure Firebase is initialized
  initializeFirebaseAdmin();
  // Return the firestore instance
  return getFirestore();
}

// Helper function to verify and decode a Firebase ID token
export async function verifyIdToken(token: string) {
  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying auth token:', error);
    return null;
  }
} 