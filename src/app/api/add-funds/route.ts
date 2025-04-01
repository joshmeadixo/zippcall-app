import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin, getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Ensure Firebase Admin is initialized
initializeFirebaseAdmin();

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Authorization Token
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    
    let decodedToken;
    try {
      decodedToken = await getAdminAuth().verifyIdToken(idToken);
    } catch (error) {
      console.error('Error verifying auth token:', error);
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 403 });
    }
    const userId = decodedToken.uid;

    // 2. Get and Validate Amount
    const { amount } = await req.json();

    if (typeof amount !== 'number' || amount <= 0 || !Number.isFinite(amount)) {
      return NextResponse.json({ error: 'Invalid amount specified. Amount must be a positive number.' }, { status: 400 });
    }
    
    // For safety, let's cap the maximum amount that can be added in one go (e.g., $1000)
    // This is also where you might check against minimum amounts later
    const MAX_ADD_AMOUNT = 1000; 
    if (amount > MAX_ADD_AMOUNT) {
        return NextResponse.json({ error: `Amount cannot exceed $${MAX_ADD_AMOUNT}.` }, { status: 400 });
    }

    // 3. Update Firestore using Admin SDK
    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(userId);

    // Use a transaction for atomicity, although increment is atomic itself, 
    // a transaction allows reading the balance *after* incrementing within the same atomic operation.
    const newBalance = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        // This should ideally not happen if ensureUserDocument works correctly
        throw new Error('User document does not exist.'); 
      }
      
      // Increment the balance using FieldValue.increment
      transaction.update(userRef, {
        balance: FieldValue.increment(amount)
      });
      
      // Read the balance *after* the update within the transaction
      const currentBalance = (userDoc.data()?.balance || 0) + amount;
      return currentBalance; 
    });

    console.log(`Successfully added ${amount} to balance for user ${userId}. New balance: ${newBalance}`);
    
    // 4. Return Success Response
    return NextResponse.json({ success: true, newBalance: newBalance });

  } catch (error: any) {
    console.error('Error in /api/add-funds:', error);
    // Provide a generic error message to the client
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    // Determine status code based on error type if possible, otherwise default to 500
    const status = error.message === 'User document does not exist.' ? 404 : 500; 
    return NextResponse.json({ error: `Failed to add funds: ${message}` }, { status: status });
  }
} 