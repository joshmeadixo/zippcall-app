import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin, getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore'; // Import Timestamp

// Ensure Firebase Admin is initialized
initializeFirebaseAdmin();

// Define a type for the transaction data we expect to return
// Match the fields we are saving in the other API routes
interface TransactionData {
  id: string; // Document ID
  type: 'deposit' | 'call' | 'adjustment'; // Add more types as needed
  amount: number;
  currency: string;
  status: string;
  source: string;
  createdAt: string; // ISO string format for frontend
  // Optional fields based on type
  stripeSessionId?: string;
  callId?: string;
  phoneNumber?: string;
  durationSeconds?: number;
}

const MAX_TRANSACTIONS_TO_FETCH = 50; // Limit the number of transactions fetched

export async function GET(req: NextRequest) {
  try {
    // 1. Verify User Authentication
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    
    let decodedToken;
    try {
      decodedToken = await getAdminAuth().verifyIdToken(idToken);
    } catch (error) {
      console.error('[API /transactions] Error verifying auth token:', error);
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 403 });
    }
    const userId = decodedToken.uid;

    // 2. Query Firestore
    const db = getAdminFirestore();
    const transactionsRef = db.collection('users').doc(userId).collection('transactions');
    
    console.log(`[API /transactions] Fetching transactions for user ${userId}`);

    const querySnapshot = await transactionsRef
                                .orderBy('createdAt', 'desc') // Get latest first
                                .limit(MAX_TRANSACTIONS_TO_FETCH) // Limit results
                                .get();

    // 3. Format Data
    const transactions: TransactionData[] = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Convert Firestore Timestamp to ISO string
        const createdAtIso = data.createdAt instanceof Timestamp 
                             ? data.createdAt.toDate().toISOString() 
                             : new Date().toISOString(); // Fallback if needed, though should always be Timestamp
                             
        transactions.push({
            id: doc.id,
            type: data.type || 'unknown', // Add default/validation
            amount: data.amount || 0,
            currency: data.currency || 'usd',
            status: data.status || 'unknown',
            source: data.source || 'unknown',
            createdAt: createdAtIso,
            // Include optional fields if they exist
            ...(data.stripeSessionId && { stripeSessionId: data.stripeSessionId }),
            ...(data.callId && { callId: data.callId }),
            ...(data.phoneNumber && { phoneNumber: data.phoneNumber }),
            ...(data.durationSeconds !== undefined && { durationSeconds: data.durationSeconds }),
        });
    });

    console.log(`[API /transactions] Found ${transactions.length} transactions for user ${userId}`);

    // 4. Return Success Response
    return NextResponse.json(transactions);

  } catch (error: any) {
    console.error('[API /transactions] Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: `Failed to fetch transactions: ${message}` }, { status: 500 });
  }
} 