import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { User } from 'firebase/auth';

/**
 * Ensures that a user document exists in Firestore for the given user
 * If the document doesn't exist, it creates one with default values
 * @param user Firebase Auth user object
 */
export async function ensureUserDocument(user: User): Promise<void> {
  if (!user || !user.uid) {
    console.error('Invalid user provided to ensureUserDocument');
    return;
  }
  
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    // Create a new user document with default values
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      createdAt: new Date(),
      lastLogin: new Date(),
      isAdmin: false, // Default to non-admin
      phoneNumber: user.phoneNumber || '',
      balance: 0, // Initialize balance to 0
    });
    console.log(`Created new user document for ${user.email}`);
  } else {
    // Update the lastLogin field
    await updateDoc(userRef, {
      lastLogin: new Date(),
    });
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