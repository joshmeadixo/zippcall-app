import { NextRequest, NextResponse } from 'next/server';
// Add Firebase Admin imports
import { initializeFirebaseAdmin, getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
// Import pricing functions
import { getPriceForPhoneNumber, calculateCallCost } from '@/lib/pricing/pricing-engine';

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

        // --- Add Cost Calculation Logic --- 
        let finalCost = 0;
        // Only calculate cost if the call was answered and had duration
        if (appStatus === 'answered' && durationToSave > 0) {
            try {
                const pricingInfo = await getPriceForPhoneNumber(to);
                if (pricingInfo && !pricingInfo.isUnsupported) {
                    finalCost = calculateCallCost(
                        pricingInfo.finalPrice, // Use the calculated final price from pricing engine
                        durationToSave,
                        pricingInfo.billingIncrement
                    );
                    console.log(`[Public Callback] Calculated cost for ${durationToSave}s to ${to}: ${finalCost}`);
                } else {
                    console.warn(`[Public Callback] Could not get pricing or country unsupported for ${to}. Setting cost to 0 for CallSid: ${callSid}`);
                }
            } catch (pricingError) {
                 console.error(`[Public Callback] Error fetching or calculating pricing for ${to}:`, pricingError);
                 // Keep cost at 0 if pricing fails
            }
        } else {
             console.log(`[Public Callback] Call status is '${appStatus}' or duration is 0. Setting cost to 0 for CallSid: ${callSid}`);
        }
        // --- End Cost Calculation Logic --- 

        const callDataToUpdate = {
            userId: userId,
            callSid: callSid,
            status: appStatus, // Use our mapped status
            duration: durationToSave,
            cost: finalCost, // Use the calculated cost
            phoneNumber: to,
            callerId: from,
            direction: 'outgoing',
            timestamp: FieldValue.serverTimestamp(), // Use server timestamp for the event time
            twilioStatus: callStatus, // Store the original Twilio status
            accountSid: accountSid,
            createdAt: FieldValue.serverTimestamp() // Explicitly use createdAt for admin sorting/display
        };

        // --- Database Transaction (Update Call History & User Balance) ---
        const userRef = db.collection('users').doc(userId);

        try {
            // Only run transaction if cost is greater than 0
            if (finalCost > 0) {
                 console.log(`[Public Callback] Attempting transaction for CallSid: ${callSid}, Cost: ${finalCost}`);
                 const newBalance = await db.runTransaction(async (transaction) => {
                    const userDoc = await transaction.get(userRef);
                    if (!userDoc.exists) {
                        throw new Error(`User ${userId} not found during transaction.`);
                    }
                    const currentBalance = userDoc.data()?.balance || 0;

                    // Check for sufficient funds (add tolerance for floating point)
                    const tolerance = 0.0001;
                    let insufficientFunds = false;
                    if (currentBalance < finalCost - tolerance) {
                        console.warn(`[Public Callback] Transaction: User ${userId} has insufficient funds (${currentBalance}) for call cost (${finalCost}). Balance will not be deducted.`);
                        insufficientFunds = true;
                        // We still record the call with its cost, just don't deduct
                    }

                    // Always update Call History within the transaction
                    transaction.set(callHistoryRef, callDataToUpdate, { merge: true }); 
                    console.log(`[Public Callback] Transaction: Updated call history for ${callSid}.`);

                    let deductedAmount = 0;
                    // Update Balance & create transaction record ONLY if sufficient funds
                    if (!insufficientFunds) {
                        transaction.update(userRef, {
                            balance: FieldValue.increment(-finalCost)
                        });
                        deductedAmount = finalCost;
                        console.log(`[Public Callback] Transaction: Decremented balance by ${finalCost} for user ${userId}.`);
                        
                        // Create a transaction record for the deduction
                        const transactionRef = userRef.collection('transactions').doc(); // Auto-generate ID
                        transaction.set(transactionRef, {
                            type: 'call',
                            amount: -finalCost,
                            currency: 'usd',
                            status: 'completed',
                            source: 'system', // Indicates it came from the system (call processing)
                            callId: callSid,
                            phoneNumber: to, // Store the called number
                            durationSeconds: durationToSave, // Store the duration
                            createdAt: FieldValue.serverTimestamp() // Use server time
                        });
                         console.log(`[Public Callback] Transaction: Created transaction record for call ${callSid}.`);
                    } else {
                        // If funds are insufficient, we already logged the warning.
                        // Call history is still saved outside this condition if cost > 0.
                    }

                    // Return the potentially updated balance (or current if no deduction)
                    return currentBalance - deductedAmount; 
                });
                console.log(`[Public Callback] Transaction successful for CallSid: ${callSid}. User ${userId} new balance approx: ${newBalance}`);
            } else {
                // If cost is 0, just record the call history directly without a transaction
                console.log(`[Public Callback] Cost is 0 for CallSid: ${callSid}. Recording history directly.`);
                await callHistoryRef.set(callDataToUpdate, { merge: true });
                console.log(`[Public Callback] Recorded call history for CallSid: ${callSid} (Cost 0).`);
            }
        } catch (error) {
            console.error(`[Public Callback] Transaction failed for CallSid: ${callSid}, User: ${userId}:`, error);
            // CRITICAL: If transaction fails, still try to record the call history
            // outside the transaction, but maybe with an error flag or zero cost? 
            // For now, we log the error and let the function proceed to return 200 to Twilio.
            // Consider adding fallback logic here if necessary.
            try {
                // Fallback: Attempt to save history even if transaction failed, maybe mark as error?
                 callDataToUpdate.cost = 0; // Set cost to 0 if transaction failed
                 callDataToUpdate.status = 'failed'; // Optionally mark status as failed due to transaction error
                 await callHistoryRef.set(callDataToUpdate, { merge: true });
                 console.warn(`[Public Callback] Transaction failed, saved call history ${callSid} with 0 cost.`);
            } catch (fallbackError) {
                 console.error(`[Public Callback] Fallback save failed for ${callSid} after transaction error:`, fallbackError);
            }
        }
        // --- End Database Transaction --- 
        
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