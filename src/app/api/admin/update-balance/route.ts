import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin, getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

// Ensure Firebase Admin is initialized
initializeFirebaseAdmin();

interface UpdateBalanceRequest {
  targetUserId: string;
  newBalance: number;
}

// Define a custom error interface for Firestore errors
interface FirestoreError extends Error {
  code?: number;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Requester is Admin
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    
    let decodedToken;
    try {
      decodedToken = await getAdminAuth().verifyIdToken(idToken);
    } catch (error) {
      console.error('[API /admin/update-balance] Error verifying auth token:', error);
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 403 });
    }
    const requesterUid = decodedToken.uid;

    const db = getAdminFirestore();
    const requesterRef = db.collection('users').doc(requesterUid);
    const requesterSnap = await requesterRef.get();

    if (!requesterSnap.exists || !requesterSnap.data()?.isAdmin) {
      console.warn(`[API /admin/update-balance] Unauthorized access attempt by user: ${requesterUid}`);
      return NextResponse.json({ error: 'Forbidden: Administrator access required' }, { status: 403 });
    }

    // 2. Get and Validate Request Body
    const { targetUserId, newBalance } = (await req.json()) as UpdateBalanceRequest;

    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid targetUserId' }, { status: 400 });
    }
    
    // Validate newBalance - must be a number, potentially non-negative
    if (typeof newBalance !== 'number' || !Number.isFinite(newBalance) || newBalance < 0) {
        console.warn(`[API /admin/update-balance] Invalid newBalance value received: ${newBalance}`);
        return NextResponse.json({ error: 'Invalid newBalance value. Must be a non-negative number.' }, { status: 400 });
    }
    
    // Ensure admin is not accidentally modifying their own balance via this specific route? (Optional check)
    // if (requesterUid === targetUserId) {
    //   return NextResponse.json({ error: 'Cannot modify own balance via this route.' }, { status: 400 });
    // }

    // 3. Update Target User's Balance
    console.log(`[API /admin/update-balance] Admin ${requesterUid} attempting to set balance for user ${targetUserId} to ${newBalance}`);
    const targetUserRef = db.collection('users').doc(targetUserId);
    
    try {
      await targetUserRef.update({ 
        balance: newBalance 
      });
      console.log(`[API /admin/update-balance] Successfully updated balance for user ${targetUserId} to ${newBalance}`);
    } catch (error: unknown) {
        // Check if the error is because the user document doesn't exist
        if (error instanceof Error && 'code' in error && (error as FirestoreError).code === 5) { // Firestore error code for NOT_FOUND
             console.error(`[API /admin/update-balance] Target user document not found: ${targetUserId}`);
             return NextResponse.json({ error: `Target user with ID ${targetUserId} not found.` }, { status: 404 });
        } else {
             // Re-throw for the outer catch block to handle generic errors
             throw error;
        }
    }
    
    // 4. Return Success Response
    return NextResponse.json({ success: true, updatedUserId: targetUserId, newBalance: newBalance });

  } catch (error: unknown) {
    console.error('[API /admin/update-balance] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    // Avoid exposing detailed internal errors
    return NextResponse.json({ error: `Failed to update balance: ${errorMessage}` }, { status: 500 });
  }
} 