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
    console.log('[Twilio Status Callback] Received request');

    // --- Request Validation ---
    // To ensure the request is genuinely from Twilio
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

    if (!twilioAuthToken) {
        console.error('[Twilio Status Callback] TWILIO_AUTH_TOKEN not set. Cannot validate request.');
    } else if (!signature) {
        console.warn('[Twilio Status Callback] Missing X-Twilio-Signature. Request cannot be validated.');
    } else {
        // Validate the request
        const isValid = twilio.validateRequest(
            twilioAuthToken,
            signature,
            url,
            body
        );

        if (!isValid) {
            console.warn('[Twilio Status Callback] Invalid Twilio signature.');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
        }
        console.log('[Twilio Status Callback] Twilio signature validated successfully.');
    }

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

        if (!callSid) {
            console.error('[Twilio Status Callback] Missing CallSid in request.');
            return NextResponse.json({ error: 'Missing CallSid' }, { status: 400 });
        }

        if (!userId) {
            console.error(`[Twilio Status Callback] Missing UserId for CallSid: ${callSid}. Cannot attribute call.`);
            return NextResponse.json({ error: 'Missing UserId parameter' }, { status: 400 });
        }

        const db = getAdminFirestore();
        const callHistoryRef = db.collection('callHistory').doc(callSid);

        // --- Idempotency Check ---
        const existingCallDoc = await callHistoryRef.get();
        if (existingCallDoc.exists && existingCallDoc.data()?.status === callStatus) {
            console.warn(`[Twilio Status Callback] Final status update for CallSid ${callSid} (${callStatus}) already processed. Skipping.`);
            return new NextResponse('Status already processed', { status: 200 });
        }

        // Convert duration to a number (default to 0 if missing or invalid)
        const callDuration = parseInt(callDurationStr || '0', 10);
        if (isNaN(callDuration)) {
            console.warn(`[Twilio Status Callback] Invalid CallDuration '${callDurationStr}' for CallSid: ${callSid}. Using 0.`);
        }
        const finalDuration = isNaN(callDuration) ? 0 : callDuration;

        // Determine the cost based on the *actual* duration
        let finalCost = 0;
        // Only calculate cost if the call was 'completed' (answered) and had duration
        if (callStatus === 'completed' && finalDuration > 0) {
            // Fetch pricing details for the dialed number ('to')
            const pricingInfo = await getPriceForPhoneNumber(to);
            if (pricingInfo && !pricingInfo.isUnsupported) {
                finalCost = calculateCallCost(
                    pricingInfo.finalPrice,
                    finalDuration,
                    pricingInfo.billingIncrement
                );
                 console.log(`[Twilio Status Callback] Calculated cost for ${finalDuration}s to ${to}: ${finalCost}`);
            } else {
                console.warn(`[Twilio Status Callback] Could not get pricing or country unsupported for ${to}. Setting cost to 0 for CallSid: ${callSid}`);
            }
        } else {
             console.log(`[Twilio Status Callback] Call status is '${callStatus}' or duration is 0. Setting cost to 0 for CallSid: ${callSid}`);
        }

        // Map Twilio status to our application status
        let appStatus: 'answered' | 'missed' | 'rejected' | 'failed' | 'canceled';
        switch (callStatus) {
            case 'completed': appStatus = 'answered'; break;
            case 'no-answer': appStatus = 'missed'; break;
            case 'busy': appStatus = 'rejected'; break;
            case 'failed': appStatus = 'failed'; break;
            case 'canceled': appStatus = 'canceled'; break;
            default: appStatus = 'failed';
        }

        const callDataToUpdate = {
            userId: userId,
            callSid: callSid,
            status: appStatus,
            duration: finalDuration,
            cost: finalCost,
            phoneNumber: to,
            callerId: from,
            direction: 'outgoing',
            timestamp: FieldValue.serverTimestamp(),
            twilioStatus: callStatus,
            accountSid: accountSid,
            processedAt: FieldValue.serverTimestamp()
        };

        // --- Database Transaction (Update Call History & User Balance) ---
        const userRef = db.collection('users').doc(userId);

        // Check if cost needs deduction (only if > 0)
        if (finalCost > 0) {
             console.log(`[Twilio Status Callback] Attempting to deduct cost ${finalCost} for user ${userId}`);
            try {
                 const newBalance = await db.runTransaction(async (transaction) => {
                    const userDoc = await transaction.get(userRef);
                    if (!userDoc.exists) {
                        throw new Error(`User ${userId} not found.`);
                    }
                    const currentBalance = userDoc.data()?.balance || 0;

                    // Check for sufficient funds
                    const tolerance = 0.0001; // Small tolerance for floating point comparisons
                    if (currentBalance < finalCost - tolerance) {
                        console.warn(`[Twilio Status Callback] User ${userId} has insufficient funds (${currentBalance}) for call cost (${finalCost}). Balance will not be deducted correctly.`);
                        callDataToUpdate.cost = finalCost;
                    }

                    // Update Call History within the transaction
                    transaction.set(callHistoryRef, callDataToUpdate, { merge: true });

                    // Update Balance only if sufficient funds
                    let deductedAmount = 0;
                    if (currentBalance >= finalCost - tolerance && finalCost > 0) {
                        transaction.update(userRef, {
                            balance: FieldValue.increment(-finalCost)
                        });
                        deductedAmount = finalCost;

                        // Create a transaction record for the deduction
                        const transactionRef = userRef.collection('transactions').doc();
                        transaction.set(transactionRef, {
                            type: 'call',
                            amount: -finalCost,
                            currency: 'usd',
                            status: 'completed',
                            source: 'system',
                            callId: callSid,
                            phoneNumber: to,
                            durationSeconds: finalDuration,
                            createdAt: FieldValue.serverTimestamp()
                        });
                    } else if (finalCost > 0) {
                        console.warn(`[Twilio Status Callback] Transaction: Insufficient funds for User ${userId}. Cost ${finalCost}, Balance ${currentBalance}. No balance deduction performed.`);
                    }

                    return currentBalance - deductedAmount;
                });
                 console.log(`[Twilio Status Callback] Transaction successful for CallSid: ${callSid}. User ${userId} new balance approx: ${newBalance}`);

            } catch (error) {
                console.error(`[Twilio Status Callback] Transaction failed for CallSid: ${callSid}, User: ${userId}:`, error);
                return NextResponse.json({ error: 'Database transaction failed' }, { status: 500 });
            }
        } else {
            // If cost is 0, just record the call history without a balance transaction
            console.log(`[Twilio Status Callback] Cost is 0 for CallSid: ${callSid}. Recording history only.`);
            await callHistoryRef.set(callDataToUpdate, { merge: true });
            console.log(`[Twilio Status Callback] Recorded call history for CallSid: ${callSid}`);
        }

        // Respond to Twilio - MUST be a simple 200 OK or empty response
        return new NextResponse('<Response/>', {
            status: 200,
            headers: { 'Content-Type': 'text/xml' }
        });

    } catch (error: unknown) {
        console.error('[Twilio Status Callback] Error processing callback:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Optional: Handle GET requests for testing
export async function GET() {
    return NextResponse.json({ message: 'Twilio Status Callback endpoint. Use POST.' });
} 