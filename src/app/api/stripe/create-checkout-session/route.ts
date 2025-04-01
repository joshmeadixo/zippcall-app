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
    // Debug environment variables
    console.log('[API create-checkout] Environment check:');
    console.log(`[API create-checkout] NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL}`);
    console.log(`[API create-checkout] NODE_ENV: ${process.env.NODE_ENV}`);
    
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

    // 3. Define URLs - PRIORITIZE SERVER-SIDE APP_URL
    // Server-side only variable takes precedence over client-exposed variable
    let appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    
    // Debug all environment variables available
    console.log('[API create-checkout] Environment variables check:');
    console.log(`[API create-checkout] APP_URL: ${process.env.APP_URL}`);
    console.log(`[API create-checkout] NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL}`);
    
    // Additional fallback: Try to detect the domain from request headers
    if (!appUrl || appUrl.includes('localhost')) {
      const host = req.headers.get('host');
      const protocol = req.headers.get('x-forwarded-proto') || 'http';
      
      if (host && !host.includes('localhost')) {
        const detectedUrl = `${protocol}://${host}`;
        console.log(`[API create-checkout] Detected URL from request: ${detectedUrl}`);
        appUrl = detectedUrl;
      } else {
        console.log(`[API create-checkout] Using default localhost URL as fallback`);
        appUrl = 'http://localhost:3000';
      }
    }
    
    const successUrl = `${appUrl}/dashboard?stripe_session_id={CHECKOUT_SESSION_ID}`; // Pass session ID back
    const cancelUrl = `${appUrl}/dashboard`; // Redirect back to dashboard on cancel

    // Debug logging for URL construction
    console.log(`[API create-checkout] Using base URL: ${appUrl}`);
    console.log(`[API create-checkout] Success redirect URL: ${successUrl}`);
    console.log(`[API create-checkout] Cancel redirect URL: ${cancelUrl}`);

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

  } catch (error: unknown) {
    console.error('Error in create-checkout-session:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 