'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * Fetches the total count of documents in the 'users' collection.
 */
export async function getTotalUsers(): Promise<number> {
  try {
    const db = getAdminFirestore();
    const usersRef = db.collection('users');
    
    // Getting the count efficiently using collection group might be better if users are deeply nested
    // but for a top-level collection, get() and counting docs or using aggregateFromServer is fine.
    // Using aggregateFromServer for potentially better performance on large collections.
    const snapshot = await usersRef.count().get();
    const count = snapshot.data().count;

    console.log(`[Admin Actions] Fetched total users count: ${count}`);
    return count;

  } catch (error) {
    console.error('[Admin Actions] Error fetching total users count:', error);
    // Return 0 or handle the error as appropriate for your application
    return 0;
  }
}

// Define the return type for the user list
export interface AdminUserRecord {
  uid: string;
  email: string | null;
  displayName: string;
  phoneNumber: string | null;
  photoURL?: string | null; // Add photoURL if needed based on original API
  isAdmin: boolean;
  balance: number;
  lastLogin: string | null;
  createdAt: string | null;
}

/**
 * Fetches a list of all users primarily from the Firestore 'users' collection.
 * Mirrors the logic previously used in the /api/admin/users route.
 */
export async function getAdminUsers(limit: number = 1000): Promise<AdminUserRecord[]> {
  console.log('[Admin Actions] Attempting to fetch users list from Firestore...');
  try {
    // Ensure Firestore is initialized
    const db = getAdminFirestore(); 

    // Fetch user documents from Firestore
    // Apply limit if needed, but consider pagination for very large collections
    const usersCollection = db.collection('users');
    const usersSnapshot = await usersCollection.limit(limit).get();

    // Format User Data (similar to original API route)
    const usersList: AdminUserRecord[] = usersSnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Helper function to safely format Firestore Timestamps
      const formatFirestoreTimestamp = (timestamp: unknown): string | null => {
        if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
          try {
            return timestamp.toDate().toISOString();
          } catch {
            return null; // Handle invalid date/timestamp object
          }
        } else if (typeof timestamp === 'string') {
          // Attempt to parse if it's already a string (less likely for Timestamps)
           try {
            return new Date(timestamp).toISOString();
          } catch {
            return null;
          }
        }
        return null;
      };

      return {
        uid: doc.id,
        email: data.email || null,
        displayName: data.displayName || 'N/A',
        phoneNumber: data.phoneNumber || null,
        photoURL: data.photoURL || null, // Include photoURL if it was in the original
        isAdmin: data.isAdmin || false,
        balance: typeof data.balance === 'number' ? data.balance : 0,
        lastLogin: formatFirestoreTimestamp(data.lastLogin),
        createdAt: formatFirestoreTimestamp(data.createdAt),
      };
    });

    console.log(`[Admin Actions] Successfully processed ${usersList.length} user records from Firestore.`);
    return usersList;

  } catch (error) {
    console.error('[Admin Actions] Error fetching users list from Firestore:', error);
    return []; // Return empty array on error
  }
} 