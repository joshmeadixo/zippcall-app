import { NextRequest, NextResponse } from 'next/server';
// Add Firebase Admin imports
import { initializeFirebaseAdmin, getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Ensure Firebase Admin is initialized (idempotent)
initializeFirebaseAdmin();

// ABSOLUTELY NO AUTHENTICATION - PUBLIC ENDPOINT FOR TESTING
export async function POST(req: NextRequest) {
    // Log immediately
    console.log('!!PUBLIC ENDPOINT!! Received Twilio callback request');
    
    try {
        // Get the raw request body
        const rawBody = await req.text();
        
        // Parse the form data
        const params = new URLSearchParams(rawBody);
        const body: Record<string, string> = {};
        params.forEach((value, key) => {
            body[key] = value;
        });
        
        // Log all the data we received
        console.log('PUBLIC CALLBACK Body:', body);
        console.log('PUBLIC CALLBACK Headers:', Object.fromEntries(req.headers.entries()));
        console.log('PUBLIC CALLBACK URL:', req.url);
        
        // Extract useful data
        const callSid = body.CallSid;
        const callStatus = body.CallStatus;
        const callDurationStr = body.CallDuration; // Duration in seconds (string)
        const to = body.To; // The number that was called
        const from = body.From; // The caller ID used
        const accountSid = body.AccountSid;

        // Get UserId from query param
        const url = new URL(req.url);
        const userId = url.searchParams.get('UserId');
        
        console.log(`PUBLIC CALLBACK Processing: CallSid=${callSid}, Status=${callStatus}, Duration=${callDurationStr}s, UserId=${userId}`);

        // --- Restore Firestore Logic --- 

        if (!callSid) {
            console.error('[Public Callback] Missing CallSid in request.');
            // Still return 200 to Twilio, but log the error
            return new NextResponse('<Response/>', {
                status: 200,
                headers: { 'Content-Type': 'text/xml' }
            });
        }

        if (!userId) {
            console.error(`[Public Callback] Missing UserId for CallSid: ${callSid}. Cannot attribute call.`);
             // Still return 200 to Twilio
            return new NextResponse('<Response/>', {
                status: 200,
                headers: { 'Content-Type': 'text/xml' }
            });
        }

        const db = getAdminFirestore();
        const callHistoryRef = db.collection('callHistory').doc(callSid);

        // Convert duration to a number (default to 0 if missing or invalid)
        const finalDuration = parseInt(callDurationStr || '0', 10);
        if (isNaN(finalDuration)) {
            console.warn(`[Public Callback] Invalid CallDuration '${callDurationStr}' for CallSid: ${callSid}. Using 0.`);
        }
        const durationToSave = isNaN(finalDuration) ? 0 : finalDuration;

        // Map Twilio status to our application status
        let appStatus: 'answered' | 'missed' | 'rejected' | 'failed' | 'canceled' | 'unknown';
        switch (callStatus) {
            case 'completed': appStatus = 'answered'; break;
            case 'no-answer': appStatus = 'missed'; break;
            case 'busy': appStatus = 'rejected'; break;
            case 'failed': appStatus = 'failed'; break;
            case 'canceled': appStatus = 'canceled'; break;
            default: 
                console.warn(`[Public Callback] Unknown Twilio status: ${callStatus} for CallSid: ${callSid}`);
                appStatus = 'unknown'; // Handle unexpected statuses
                break;
        }

        const callDataToUpdate = {
            userId: userId,
            callSid: callSid,
            status: appStatus, // Use our mapped status
            duration: durationToSave,
            cost: 0, // Keep cost 0 for now
            phoneNumber: to,
            callerId: from,
            direction: 'outgoing',
            timestamp: FieldValue.serverTimestamp(), // Use server timestamp for the event time
            twilioStatus: callStatus, // Store the original Twilio status
            accountSid: accountSid,
            createdAt: FieldValue.serverTimestamp() // Explicitly use createdAt for admin sorting/display
        };

        // Save to Firestore
        await callHistoryRef.set(callDataToUpdate, { merge: true });
        console.log(`[Public Callback] Recorded call history for CallSid: ${callSid}, UserId: ${userId}, Status: ${appStatus}`);

        // --- End Firestore Logic --- 
        
        // Always return 200 OK with CORS headers
        return new NextResponse('<Response/>', {
            status: 200,
            headers: {
                'Content-Type': 'text/xml',
                'Access-Control-Allow-Origin': '*', // Keep CORS headers
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });
    } catch (error) {
        console.error('PUBLIC CALLBACK Error:', error);
        
        // Even on error, return 200 to Twilio but log internally
        return new NextResponse('<Response/>', {
            status: 200,
            headers: {
                'Content-Type': 'text/xml',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// Handle GET for testing
export async function GET() {
    return new NextResponse('Twilio Public Webhook Endpoint - Send POST requests here', {
        status: 200,
        headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*'
        }
    });
} 