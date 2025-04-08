import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin, getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import twilio from 'twilio';
import { getPriceForPhoneNumber, calculateCallCost } from '@/lib/pricing/pricing-engine'; 

// Ensure Firebase Admin is initialized
initializeFirebaseAdmin();

// Environment variables for Twilio validation
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

export async function POST(req: NextRequest) {
    // EARLY LOGGING: Log at the very start before any other code
    console.log('!!IMPORTANT!! [Twilio Status Callback] POST handler is executing');
    try {
        console.log('[Twilio Status Callback] Received request');

        // --- Request Validation ---
        // For testing purposes, we're BYPASSING validation entirely
        const signature = req.headers.get('x-twilio-signature');
        const url = req.url; 
        const rawBody = await req.text(); 

        // Reconstruct the body as a Record<string, string>
        const params = new URLSearchParams(rawBody);
        const body: Record<string, string> = {};
        params.forEach((value, key) => {
            body[key] = value;
        });

        console.log('[Twilio Status Callback] Request Body:', body);
        console.log('[Twilio Status Callback] Headers:', Object.fromEntries(req.headers.entries()));

        // BYPASSING TWILIO VALIDATION - ACCEPT ALL REQUESTS
        // if (!twilioAuthToken) {
        //    console.error('[Twilio Status Callback] TWILIO_AUTH_TOKEN not set. Cannot validate request.');
        // } else if (!signature) {
        //    console.warn('[Twilio Status Callback] Missing X-Twilio-Signature. Request cannot be validated.');
        // } else {
        //    // --- Added detailed logging for validation --- 
        //    console.log('[Twilio Status Callback] Data for validation:');
        //    console.log(`[Twilio Status Callback] Auth Token Hint: ${twilioAuthToken ? 'Present' : 'MISSING'}`);
        //    console.log(`[Twilio Status Callback] Signature: ${signature}`);
        //    console.log(`[Twilio Status Callback] URL for validation: ${url}`);
        //    console.log(`[Twilio Status Callback] Params for validation: ${JSON.stringify(body)}`);
        //    // -------------------------------------------
        //    
        //    // Validate the request
        //    const isValid = twilio.validateRequest(
        //        twilioAuthToken,
        //        signature,
        //        url,
        //        body
        //    );
        //
        //    if (!isValid) {
        //        console.warn('[Twilio Status Callback] Invalid Twilio signature.');
        //        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
        //    }
        //    console.log('[Twilio Status Callback] Twilio signature validated successfully.');
        // }

        try {
            // Extract relevant data from Twilio's request
            const callSid = body.CallSid;
            const callStatus = body.CallStatus; // e.g., 'completed', 'no-answer', 'busy', 'failed', 'canceled'
            const callDurationStr = body.CallDuration; // Duration in seconds (string)
            const to = body.To; // The number that was called
            const from = body.From; // The caller ID used
            const accountSid = body.AccountSid;
            
            // Get the UserId from query parameters (passed in the statusCallback URL)
            const url = new URL(req.url);
            const userId = url.searchParams.get('UserId');

            console.log(`[Twilio Status Callback] Processing CallSid: ${callSid}, Status: ${callStatus}, Duration: ${callDurationStr}s, UserId: ${userId}`);
          
            // For testing purposes, accept the request without further processing
            console.log('[Twilio Status Callback] ✅ TEST MODE: Accepting request without further processing');
            
            // Respond to Twilio with a success response
            return new NextResponse('<Response/>', {
                status: 200,
                headers: { 'Content-Type': 'text/xml' }
            });

            // The rest of the function is commented out for now to simplify testing
            
            // Implement the rest of your function logic here
            // ...
        } catch (error) {
            console.error('[Twilio Status Callback] Error in callback processing:', error);
            return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
        }
    } catch (mainError) {
        // Catch any errors at the top level to ensure we log them
        console.error('!!CRITICAL!! [Twilio Status Callback] Top-level error:', mainError);
        return NextResponse.json({ error: 'Critical server error' }, { status: 500 });
    }
}

// Optional: Handle GET requests for testing
export async function GET() {
    return NextResponse.json({ message: 'Twilio Status Callback endpoint. Use POST.' });
} 