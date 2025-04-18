import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { ensureUserDocument } from './user-db';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Email link settings
const actionCodeSettings = {
  // URL you want to redirect back to. The domain (www.example.com) for this
  // URL must be in the authorized domains list in the Firebase Console.
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  // This must be true.
  handleCodeInApp: true,
};

// Set up auth state observer to create user documents
auth.onAuthStateChanged(async (user) => {
  console.log('[FIREBASE AUTH] Auth state changed:', user ? `User ${user.uid} (${user.email})` : 'No user');
  
  if (user) {
    // Create/update user document in Firestore
    console.log('[FIREBASE AUTH] Calling ensureUserDocument for user:', user.uid);
    try {
      await ensureUserDocument(user);
      console.log('[FIREBASE AUTH] Successfully processed user document for:', user.uid);
    } catch (error) {
      console.error('[FIREBASE AUTH] Error in ensureUserDocument:', error);
    }
  }
});

export { 
  app, 
  auth, 
  db, 
  googleProvider, 
  actionCodeSettings,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
}; 