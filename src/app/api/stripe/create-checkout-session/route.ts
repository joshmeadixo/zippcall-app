import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { initializeFirebaseAdmin, getAdminAuth } from '@/lib/firebase-admin'; // Needed to verify user token

// Initialize Firebase Admin (needed for auth check)
initializeFirebaseAdmin();

// Ensure Stripe secret key is available
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables.');
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // Revert to the API version expected by the linter/types
  apiVersion: "2025-02-24.acacia", 
});

interface CheckoutRequest {
  amount: number; // Amount in dollars
}

export async function POST(req: NextRequest) {
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
      console.error('[API create-checkout] Error verifying auth token:', error);
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 403 });
    }
    const userId = decodedToken.uid;
    const userEmail = decodedToken.email; // Get email for Stripe session (optional but good)

    // 2. Get and Validate Amount
    const { amount } = (await req.json()) as CheckoutRequest;

    if (typeof amount !== 'number' || amount <= 0 || !Number.isFinite(amount)) {
      return NextResponse.json({ error: 'Invalid amount specified. Amount must be a positive number.' }, { status: 400 });
    }
    
    // Simple validation (align with modal validation if possible)
    const MIN_ADD_AMOUNT = 5;
    const MAX_ADD_AMOUNT = 100;
    const INCREMENT = 5;
    if (amount < MIN_ADD_AMOUNT || amount > MAX_ADD_AMOUNT || (amount * 100) % (INCREMENT * 100) !== 0) {
        return NextResponse.json({ error: `Invalid amount. Must be between $${MIN_ADD_AMOUNT}-${MAX_ADD_AMOUNT} in increments of $${INCREMENT}.` }, { status: 400 });
    }

    // Convert amount to cents for Stripe
    const amountInCents = Math.round(amount * 100);

    // 3. Define URLs (use environment variables ideally)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${appUrl}/dashboard?stripe_session_id={CHECKOUT_SESSION_ID}`; // Pass session ID back
    const cancelUrl = `${appUrl}/dashboard`; // Redirect back to dashboard on cancel

    console.log(`[API create-checkout] Creating session for user ${userId} to add $${amount}`);

    // 4. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], // Add other methods like 'paypal', 'google_pay', 'apple_pay' as needed
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'ZippCall Funds',
              description: `Add $${amount.toFixed(2)} to your ZippCall balance.`,
              // Add images if desired: images: ['your_logo_url.png'],
            },
            unit_amount: amountInCents, // Amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Pre-fill email if available
      customer_email: userEmail,
      // IMPORTANT: Attach metadata to link session back to your user and the amount
      metadata: {
        userId: userId, 
        amountToAdd: amount.toString(), // Store original dollar amount as string
      },
      // Use client_reference_id if you only need the userId
      // client_reference_id: userId,
    });

    // 5. Return the Session ID
    if (!session.id) {
        throw new Error('Stripe session creation failed: No session ID returned.');
    }
    
    console.log(`[API create-checkout] Stripe session created: ${session.id} for user ${userId}`);
    return NextResponse.json({ sessionId: session.id });

  } catch (error: any) {
    console.error('[API create-checkout] Error:', error);
    const message = error.message || 'An unexpected error occurred';
    // Don't expose raw Stripe errors potentially
    return NextResponse.json({ error: `Failed to create checkout session: ${message}` }, { status: 500 });
  }
} 