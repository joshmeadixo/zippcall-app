import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin, getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { CallHistoryEntry } from '@/components/CallHistory'; // Reuse the type from frontend

// Ensure Firebase Admin is initialized
initializeFirebaseAdmin();

// Define expected structure for the request body, based on CallHistoryEntry but making cost required
interface RecordCallRequest extends Omit<CallHistoryEntry, 'cost'> {
  cost: number; // Make cost mandatory for this operation
}

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

    // 2. Get and Validate Call Data from Request Body
    const callData = (await req.json()) as RecordCallRequest;

    // Basic validation (add more specific checks as needed)
    if (!callData || typeof callData !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    if (typeof callData.id !== 'string' || !callData.id) {
      return NextResponse.json({ error: 'Missing or invalid call ID' }, { status: 400 });
    }
    if (typeof callData.phoneNumber !== 'string' || !callData.phoneNumber) {
      return NextResponse.json({ error: 'Missing or invalid phone number' }, { status: 400 });
    }
    if (typeof callData.timestamp !== 'number' || callData.timestamp <= 0) {
      return NextResponse.json({ error: 'Missing or invalid timestamp' }, { status: 400 });
    }
    if (typeof callData.duration !== 'number' || callData.duration < 0) {
      // Allow zero duration for failed/unanswered calls if needed, but generally positive
      return NextResponse.json({ error: 'Missing or invalid duration' }, { status: 400 });
    }
    if (typeof callData.cost !== 'number' || callData.cost < 0) {
      // Cost cannot be negative. It could be 0 for free calls.
      return NextResponse.json({ error: 'Missing or invalid call cost' }, { status: 400 });
    }
    // Validate direction and status if necessary based on enum
    if (!['incoming', 'outgoing'].includes(callData.direction)) {
      return NextResponse.json({ error: 'Invalid call direction' }, { status: 400 });
    }
     if (!['answered', 'missed', 'rejected'].includes(callData.status)) {
      return NextResponse.json({ error: 'Invalid call status' }, { status: 400 });
    }

    // 3. Perform Firestore Transaction (Deduct Balance + Save History)
    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(userId);
    // Use the call ID provided by the client for the history document
    const callHistoryRef = db.collection('callHistory').doc(callData.id); 

    // Declare variables outside transaction scope
    let costToDeduct = callData.cost; // Default to full cost
    let insufficientFunds = false; // Default to false
    let finalRecordedCost = callData.cost; // Variable to hold the cost saved to history

    const newBalance = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error('User document does not exist.'); 
      }

      const currentBalance = userDoc.data()?.balance || 0;
      const requestedCallCost = callData.cost; // Rename for clarity within transaction
      
      let newCalculatedBalance = currentBalance - requestedCallCost;

      // Check for sufficient funds
      if (currentBalance < requestedCallCost) {
        insufficientFunds = true; // Set the outer scope variable
        console.warn(`User ${userId} has insufficient funds (${currentBalance}) for full call cost (${requestedCallCost}). Deducting remaining balance.`);
        costToDeduct = currentBalance; // Update outer scope variable
        finalRecordedCost = currentBalance; // Update outer scope variable for history cost
        newCalculatedBalance = 0; 
      } else {
        // Ensure defaults are used if funds are sufficient
        costToDeduct = requestedCallCost;
        finalRecordedCost = requestedCallCost;
        insufficientFunds = false;
      }

      // Prepare call history data for saving
      const historyDataToSave = {
        ...callData,
        userId: userId, 
        cost: finalRecordedCost, // Use the variable from the outer scope
        timestamp: Timestamp.fromMillis(callData.timestamp), 
        createdAt: FieldValue.serverTimestamp(), 
        deleted: false, 
      };
      
      // Create a reference for the new transaction document in the user's subcollection
      const transactionRef = userRef.collection('transactions').doc(); // Auto-generate ID
      
      // Prepare transaction data for saving
      const transactionDataToSave = {
          type: 'call', 
          amount: -finalRecordedCost, // Store as negative value for deduction
          currency: 'usd', // Assuming USD
          status: 'completed',
          source: 'system', // Indicate it was an automatic deduction
          callId: callData.id, // Link to the call history document
          phoneNumber: callData.phoneNumber, // Include relevant details
          durationSeconds: callData.duration, // Include relevant details
          createdAt: FieldValue.serverTimestamp()
      };

      // Perform the updates within the transaction
      // 1. Update Balance
      transaction.update(userRef, {
        balance: FieldValue.increment(-costToDeduct) 
      });
      // 2. Save Call History (to separate collection)
      transaction.set(callHistoryRef, historyDataToSave); 
      // 3. Save Transaction Record (to user's subcollection)
      transaction.set(transactionRef, transactionDataToSave);

      // Return the calculated new balance
      return newCalculatedBalance; 
    });

    // Now costToDeduct is accessible here
    console.log(`Recorded call ${callData.id} for user ${userId}. Deducted ${costToDeduct}. New balance: ${newBalance}`);
    
    // 4. Return Success Response (always success if transaction completes)
    // Now insufficientFunds is accessible here
    return NextResponse.json({ success: true, newBalance: newBalance, insufficientFunds });

  } catch (error: unknown) {
    console.error('[API /call-cost] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    // Determine status code based on error type (Insufficient funds error is now handled above)
    let status = 500;
    if (errorMessage === 'User document does not exist.') {
      status = 404;
    } // No need for 402 check here anymore
    
    return NextResponse.json({ error: errorMessage }, { status: status });
  }
} 