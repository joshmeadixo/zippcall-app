import { collection, doc, getDoc, getDocs, query, setDoc, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { CallHistoryEntry } from '@/components/CallHistory';

// Firestore collection name
const CALL_HISTORY_COLLECTION = 'callHistory';

/**
 * Save a call history entry to Firestore
 * @param userId The user ID who made the call
 * @param callEntry The call history entry to save
 */
export async function saveCallHistory(userId: string, callEntry: CallHistoryEntry): Promise<void> {
  try {
    // Create a new document reference with the call ID
    const callRef = doc(db, CALL_HISTORY_COLLECTION, callEntry.id);
    
    // Add the userId to the call entry data
    const callData = {
      ...callEntry,
      userId,
      // Convert timestamp to Firestore timestamp
      timestamp: Timestamp.fromMillis(callEntry.timestamp),
      // Add server timestamp for when the record was created
      createdAt: Timestamp.now()
    };
    
    // Save to Firestore
    await setDoc(callRef, callData);
    console.log(`[saveCallHistory] Saved call history entry ${callEntry.id} for user ${userId}`);
  } catch (error) {
    console.error('[saveCallHistory] Error saving call history:', error);
    throw error;
  }
}

/**
 * Get call history for a specific user
 * @param userId The user ID to get call history for
 * @param maxResults Maximum number of results to return (default: 50)
 * @returns Array of call history entries
 */
export async function getUserCallHistory(userId: string, maxResults = 50): Promise<CallHistoryEntry[]> {
  try {
    // Create a query for the user's call history, ordered by timestamp (descending)
    // Include a where clause to filter out deleted calls
    const callsQuery = query(
      collection(db, CALL_HISTORY_COLLECTION),
      where('userId', '==', userId),
      where('deleted', '!=', true), // Filter out deleted calls
      orderBy('timestamp', 'desc'),
      limit(maxResults)
    );
    
    // Execute the query
    const querySnapshot = await getDocs(callsQuery);
    
    // Convert the query results to CallHistoryEntry objects
    const callHistory: CallHistoryEntry[] = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Convert Firestore Timestamp back to number (milliseconds)
      const timestamp = data.timestamp instanceof Timestamp
        ? data.timestamp.toMillis()
        : data.timestamp;
      
      return {
        id: doc.id,
        phoneNumber: data.phoneNumber,
        timestamp,
        duration: data.duration,
        direction: data.direction,
        status: data.status,
        cost: data.cost
      };
    });
    
    return callHistory;
  } catch (error) {
    console.error('[getUserCallHistory] Error fetching call history:', error);
    return [];
  }
}

/**
 * Delete a call history entry
 * @param callId The ID of the call to delete
 * @param userId The user ID to verify ownership
 * @returns True if deletion was successful, false otherwise
 */
export async function deleteCallHistoryEntry(callId: string, userId: string): Promise<boolean> {
  try {
    // Get the call document
    const callRef = doc(db, CALL_HISTORY_COLLECTION, callId);
    const callSnap = await getDoc(callRef);
    
    // Check if the call exists and belongs to the user
    if (!callSnap.exists()) {
      console.error(`[deleteCallHistoryEntry] Call ${callId} not found`);
      return false;
    }
    
    const callData = callSnap.data();
    if (callData.userId !== userId) {
      console.error(`[deleteCallHistoryEntry] User ${userId} does not own call ${callId}`);
      return false;
    }
    
    // Import deleteDoc directly here to avoid issues with circular dependencies
    const { deleteDoc } = await import('firebase/firestore');
    
    // Permanently delete the call document instead of just marking it as deleted
    await deleteDoc(callRef);
    console.log(`[deleteCallHistoryEntry] Permanently deleted call ${callId}`);
    return true;
  } catch (error) {
    console.error('[deleteCallHistoryEntry] Error deleting call history:', error);
    return false;
  }
} 