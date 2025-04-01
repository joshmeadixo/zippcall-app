import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { initializeFirebaseAdmin, getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin for Firestore access
initializeFirebaseAdmin();

// Ensure Stripe keys are available
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables.');
}
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET is not set in environment variables.');
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// --- IMPORTANT --- 
// Stripe requires the raw body to construct the event
// Next.js 13/14 App Router Body Parsing Config
// Add this config to ensure the raw body is available
// See: https://nextjs.org/docs/app/api-reference/file-conventions/route#request-body

// --- Restore bodyParser config --- 
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to read raw body from ReadableStream using getReader()
async function buffer(readable: ReadableStream<Uint8Array>) {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
        chunks.push(value);
    }
  }
  
  reader.releaseLock(); // Release the lock when done
  return Buffer.concat(chunks);
}

// --- REMOVE TEMPORARY DIAGNOSTIC GET HANDLER --- 
// export async function GET(req: NextRequest) {
//   console.log('[Webhook /stripe] GET request received (for diagnostics)');
//   return NextResponse.json({ message: 'GET request successful. POST handler should be available.' });
// }
// --- END REMOVED GET HANDLER --- 

export async function POST(req: NextRequest) {
  console.log('[Webhook /stripe] Received request');
  const sig = req.headers.get('stripe-signature');
  let event: Stripe.Event;

  try {
    // Check if request body exists
    if (!req.body) {
        throw new Error('Missing request body');
    }
    // Read the raw body
    const rawBody = await buffer(req.body);
    
    // Verify the signature and construct the event
    if (!sig || !webhookSecret) {
        throw new Error('Missing stripe-signature or webhook secret');
    }
    
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    console.log(`[Webhook /stripe] Event constructed: ${event.id}, Type: ${event.type}`);

  } catch (err: unknown) {
    // On error, log and return the error message
    console.error('Error in Stripe webhook:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Webhook Error: ${errorMessage}` }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`[Webhook /stripe] Handling checkout.session.completed for session: ${session.id}`);

      // Check if payment status is paid (important!)
      if (session.payment_status !== 'paid') {
        console.log(`[Webhook /stripe] Session ${session.id} payment status is ${session.payment_status}. Ignoring.`);
        break; // Exit switch, acknowledge webhook below
      }

      // Extract metadata
      const userId = session.metadata?.userId;
      const amountToAddString = session.metadata?.amountToAdd;

      if (!userId || !amountToAddString) {
        console.error(`[Webhook /stripe] Missing metadata (userId or amountToAdd) in session: ${session.id}`);
        // Return 500 because this is an issue with how we created the session
        return NextResponse.json({ error: 'Internal Server Error: Missing required metadata.' }, { status: 500 });
      }

      const amountToAdd = parseFloat(amountToAddString);
      if (isNaN(amountToAdd) || amountToAdd <= 0) {
        console.error(`[Webhook /stripe] Invalid amountToAdd metadata (${amountToAddString}) in session: ${session.id}`);
        return NextResponse.json({ error: 'Internal Server Error: Invalid amount in metadata.' }, { status: 500 });
      }

      // --- Update Firestore Balance & Record Transaction --- 
      try {
        const db = getAdminFirestore();
        const userRef = db.collection('users').doc(userId);
        // Create a reference for the new transaction document in the subcollection
        const transactionRef = userRef.collection('transactions').doc(); // Auto-generate ID
        
        // Run as a Firestore transaction
        await db.runTransaction(async (t) => {
          // Read the user document within the transaction (optional, could be used for pre-checks)
          // const userSnap = await t.get(userRef);
          // if (!userSnap.exists) {
          //   throw new Error(`User document ${userId} not found during transaction.`);
          // }

          console.log(`[Webhook /stripe Transaction] Updating balance and creating transaction record for user ${userId}`);

          // 1. Update user's balance
          t.update(userRef, {
            balance: FieldValue.increment(amountToAdd)
          });

          // 2. Create the transaction record
          t.set(transactionRef, {
            type: 'deposit', // Identify the transaction type
            amount: amountToAdd, // Positive value for deposits
            currency: 'usd', // Assuming USD
            status: 'completed', // From Stripe event
            source: 'stripe', 
            stripeSessionId: session.id, // Link back to Stripe session
            createdAt: FieldValue.serverTimestamp() // Use server timestamp
          });
        });
        
        console.log(`[Webhook /stripe] Firestore transaction successful for user ${userId} (Balance updated & transaction recorded).`);

      } catch (error: unknown) {
        console.error(`[Webhook /stripe] Firestore transaction failed for user ${userId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: `Failed to update user balance or record transaction. Error: ${errorMessage}` }, { status: 500 });
      }
      
      break; // Exit switch after handling
    }
    // ... handle other event types if needed ...
    // E.g., payment_intent.succeeded, payment_intent.payment_failed
    default:
      console.log(`[Webhook /stripe] Unhandled event type: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  console.log(`[Webhook /stripe] Acknowledging event: ${event.id}`);
  return NextResponse.json({ received: true });
} 