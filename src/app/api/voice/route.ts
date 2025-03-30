import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const to = formData.get('To') as string;
    const fromIdentity = formData.get('From') as string;
    
    const twiml = new twilio.twiml.VoiceResponse();

    // If the request contains a To parameter, we are making an outbound call
    if (to) {
      // If the To parameter starts with client:, we're making a client-to-client call
      if (to.startsWith('client:')) {
        const clientId = to.replace('client:', '');
        twiml.dial().client(clientId);
      } else {
        // Otherwise, we're making a call to a regular phone number
        const dial = twiml.dial({ callerId: process.env.TWILIO_CALLER_ID });
        dial.number(to);
      }
    } else {
      // If there's no To parameter, we're receiving an incoming call
      twiml.say('Thanks for calling. Please leave a message after the beep.');
      twiml.record();
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