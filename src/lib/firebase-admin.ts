import { App, getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth as adminGetAuth } from 'firebase-admin/auth';
import { getFirestore as adminGetFirestore } from 'firebase-admin/firestore';

// Store the initialized app instance globally within this module
let firebaseAdminApp: App | undefined;

/**
 * Initialize Firebase Admin if it hasn't been initialized already.
 * Ensures only one instance is created and returns it.
 * 
 * @returns Firebase Admin app instance
 */
export function initializeFirebaseAdmin(): App {
  // If the app is already initialized, return it directly
  if (firebaseAdminApp) {
    return firebaseAdminApp;
  }

  // Check if any Firebase Admin apps already exist (e.g., due to hot-reloading)
  // Prefer using a specific name to avoid conflicts if other default apps exist
  const existingApp = getApps().find(app => app.name === '__admin__');
  if (existingApp) {
    firebaseAdminApp = existingApp;
    return firebaseAdminApp;
  }

  // If no named app exists, create a new one
  console.log('Initializing Firebase Admin app...');
  
  // Check for required service account credentials
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  
  if (!projectId) {
    throw new Error('Firebase Admin project ID is missing in environment variables.');
  }
  
  try {
    if (clientEmail && privateKey) {
      // Initialize with service account credentials
      const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
      firebaseAdminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey
        })
      }, '__admin__'); // Use a specific name
    } else {
      // If keys are missing, check the environment
      if (process.env.NODE_ENV === 'development') {
        // Provide a specific error for local development
        throw new Error(
          'Firebase Admin Service Account credentials (clientEmail, privateKey) are missing. \
          Ensure FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY are correctly set in your .env.local file \
          and you have restarted the development server.'
        );
      } else {
        // In non-development environments (like production), attempt ADC
        console.warn('Firebase Admin Service Account credentials (email/key) not found. Attempting Application Default Credentials.');
        firebaseAdminApp = initializeApp({
          projectId
        }, '__admin__'); // Use the same specific name
      }
    }
    
    console.log('Firebase Admin initialized successfully.');
    return firebaseAdminApp;

  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
    throw new Error(`Firebase Admin initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets the Firebase Admin Auth instance associated with the initialized admin app.
 */
export function getAdminAuth() {
  const app = initializeFirebaseAdmin(); // Ensure app is initialized and get the instance
  return adminGetAuth(app); // Pass the app instance explicitly
}

/**
 * Gets the Firebase Admin Firestore instance associated with the initialized admin app.
 */
export function getAdminFirestore() {
  const app = initializeFirebaseAdmin(); // Ensure app is initialized and get the instance
  return adminGetFirestore(app); // Pass the app instance explicitly
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