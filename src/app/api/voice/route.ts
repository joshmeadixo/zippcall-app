import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const to = formData.get('To') as string;
    // Get caller ID from formData if provided, fall back to environment variable
    const callerId = formData.get('CallerId') as string || process.env.TWILIO_CALLER_ID;
    
    const twiml = new twilio.twiml.VoiceResponse();

    // If the request contains a To parameter, we are making an outbound call
    if (to) {
      // If the To parameter starts with client:, we're making a client-to-client call
      if (to.startsWith('client:')) {
        const clientId = to.replace('client:', '');
        twiml.dial().client(clientId);
      } else {
        // Otherwise, we're making a call to a regular phone number
        // Use provided caller ID or fall back to default
        const dial = twiml.dial({ callerId });
        // Ensure the phone number is properly formatted without leading spaces
        const formattedNumber = to.trim();
        dial.number(formattedNumber);

        // Log which caller ID is being used
        console.log(`[voice] Making outgoing call to ${formattedNumber} with caller ID: ${callerId}`);
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