import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

// FIXED: Force using the production URL for callbacks
// Instead of using VERCEL_URL which gives us preview URLs that have auth requirements
const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.zippcall.com';
// Avoid using this: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.NEXT_PUBLIC_APP_URL

console.log(`[voice] Using base URL for callbacks: ${appBaseUrl}`);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const to = formData.get('To') as string;
    // Get caller ID from formData if provided, fall back to environment variable
    const callerId = formData.get('CallerId') as string || process.env.TWILIO_CALLER_ID;
    // --- Added: Get UserId from the form data ---
    const userId = formData.get('UserId') as string;
    
    const twiml = new twilio.twiml.VoiceResponse();

    // If the request contains a To parameter, we are making an outbound call
    if (to) {
      // --- Added: Check if UserId was provided ---
      if (!userId) {
          console.error('[voice] Missing UserId parameter for outgoing call.');
          twiml.say('Error: Missing user identification.');
          twiml.hangup();
          return new NextResponse(twiml.toString(), {
            headers: { 'Content-Type': 'text/xml' },
            status: 400, // Bad Request
          });
      }

      // Use both callback endpoints to maximize chances of success
      const statusCallbackUrl = `${appBaseUrl}/api/twilio-public-callback?UserId=${encodeURIComponent(userId)}`;
      console.log(`[voice] Setting statusCallbackUrl: ${statusCallbackUrl}`);

      // If the To parameter starts with client:, we're making a client-to-client call
      // Note: Status callbacks might work differently or not be needed for client calls
      if (to.startsWith('client:')) {
        const clientId = to.replace('client:', '');
        // Consider if status callbacks are needed/supported for client dialing
        twiml.dial().client(clientId);
      } else {
        // Otherwise, we're making a call to a regular phone number
        // Use provided caller ID or fall back to default
        
        // Create the Dial verb, only passing attributes valid for <Dial> itself
        const dial = twiml.dial({ 
            callerId: callerId 
            // Remove status attributes from here
        });

        // Ensure the phone number is properly formatted without leading spaces
        const formattedNumber = to.trim();
        
        // Add the <Number> noun with its specific attributes, including status callbacks
        // Type definitions correctly handle attributes here, but statusCallbackEvent needs to be an array.
        dial.number({
            statusCallback: statusCallbackUrl,
            statusCallbackMethod: 'POST',
            // Simplified events: 'answered' for connection, 'completed' for all final states.
            statusCallbackEvent: ['answered', 'completed'] 
        }, formattedNumber); // Phone number is the second argument

        // Log which caller ID is being used
        console.log(`[voice] Making outgoing call to ${formattedNumber} with caller ID: ${callerId} for UserId: ${userId}`);
      }
    } else {
      // If there's no To parameter, we're receiving an incoming call
      // Reject incoming calls with a message
      twiml.say({ voice: 'alice', language: 'en-US' }, 
        'This number belongs to Zipp Call Dot Com and does not accept incoming calls. If you were called from this number then someone was using our service to call you. Please visit our website Zipp Call Dot Come to make calls using our service.');
      twiml.hangup();
    }

    return new NextResponse(twiml.toString(), {
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error) {
    console.error('Error generating TwiML:', error);
    
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('An error occurred. Please try again later.');
    
    return new NextResponse(twiml.toString(), {
      headers: {
        'Content-Type': 'text/xml',
      },
      status: 500,
    });
  }
} 