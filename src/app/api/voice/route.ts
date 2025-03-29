import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

/**
 * TwiML Voice endpoint
 * This is the endpoint that Twilio will call when a call is initiated
 * It returns TwiML instructions for how to handle the call
 */
export async function POST(request: NextRequest) {
  try {
    // Create a new TwiML response
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    // Parse request body
    const formData = await request.formData();
    const to = formData.get('To') as string;
    const from = formData.get('From') as string;

    // Add some basic call instructions
    twiml.say(
      { voice: 'alice', language: 'en-US' },
      'Thank you for using ZippCall. Connecting your international call now.'
    );

    // Connect the call to the 'to' number
    // Use the 'callerId' attribute to set the caller ID that appears to the recipient
    const dial = twiml.dial({ callerId: from });
    dial.number(to);

    // Add a pause before ending the call
    twiml.pause({ length: 1 });

    // Add goodbye message
    twiml.say(
      { voice: 'alice', language: 'en-US' },
      'Your call has ended. Thank you for using ZippCall.'
    );

    // Return the TwiML as XML
    return new NextResponse(twiml.toString(), {
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error: any) {
    console.error('Error generating TwiML:', error);
    
    // Create a TwiML error response
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    twiml.say(
      { voice: 'alice', language: 'en-US' },
      'Sorry, there was an error processing your call. Please try again later.'
    );

    return new NextResponse(twiml.toString(), {
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  }
} 