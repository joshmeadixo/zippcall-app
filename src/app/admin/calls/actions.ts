'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Define an interface for the Call Record data returned by the action
// We include userId and convert Timestamps to serializable formats (e.g., string or number)
export interface AdminCallRecord {
  id: string;
  userId: string;
  phoneNumber: string;
  timestamp: number; // Milliseconds since epoch
  duration: number;
  direction: 'incoming' | 'outgoing';
  status: 'answered' | 'missed' | 'rejected';
  cost?: number;
  createdAt: number; // Milliseconds since epoch
}

/**
 * Fetches all call records from Firestore for the admin dashboard.
 * Orders records by creation date descending.
 */
export async function getCallRecords(): Promise<AdminCallRecord[]> {
  try {
    const db = getAdminFirestore();
    const callHistoryRef = db.collection('callHistory');

    // Query all call records, ordered by creation time (most recent first)
    // You might want to add pagination later for large datasets
    const querySnapshot = await callHistoryRef
      .orderBy('createdAt', 'desc')
      .get();

    if (querySnapshot.empty) {
      console.log('[Admin Actions] No call records found.');
      return [];
    }

    const callRecords: AdminCallRecord[] = querySnapshot.docs.map(doc => {
      const data = doc.data();

      // Convert Firestore Timestamps to milliseconds for serialization
      const timestampMillis = data.timestamp instanceof Timestamp 
        ? data.timestamp.toMillis() 
        : Date.now(); // Fallback, though should always be Timestamp
      const createdAtMillis = data.createdAt instanceof Timestamp 
        ? data.createdAt.toMillis() 
        : Date.now(); // Fallback

      return {
        id: doc.id,
        userId: data.userId || 'N/A', // Include userId
        phoneNumber: data.phoneNumber || 'N/A',
        timestamp: timestampMillis,
        duration: data.duration || 0,
        direction: data.direction || 'N/A',
        status: data.status || 'N/A',
        cost: data.cost,
        createdAt: createdAtMillis,
      };
    });

    console.log(`[Admin Actions] Fetched ${callRecords.length} call records.`);
    return callRecords;

  } catch (error) {
    console.error('[Admin Actions] Error fetching call records:', error);
    // In a real app, you might want to handle this error more gracefully
    // For now, we'll return an empty array and log the error.
    return []; 
  }
}

/**
 * Calculates the total duration of all call records.
 */
export async function getTotalCallDuration(): Promise<number> {
  try {
    const callRecords = await getCallRecords(); // Reuse existing function to get records
    
    const totalDuration = callRecords.reduce((sum, record) => sum + (record.duration || 0), 0);

    console.log(`[Admin Actions] Calculated total call duration: ${totalDuration} seconds.`);
    return totalDuration;

  } catch (error) {
    console.error('[Admin Actions] Error calculating total call duration:', error);
    return 0; // Return 0 or handle error as appropriate
  }
} 