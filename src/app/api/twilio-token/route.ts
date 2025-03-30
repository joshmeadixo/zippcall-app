import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

// Your Twilio credentials should be stored in environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKey = process.env.TWILIO_API_KEY;
const apiSecret = process.env.TWILIO_API_SECRET;
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Ensure all required env variables are present
    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      console.error('Missing required environment variables for Twilio');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Create an Access Token
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    // Create a Voice grant for this token
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });

    // Create an access token which we will sign and return to the client
    const token = new AccessToken(
      accountSid,
      apiKey,
      apiSecret,
      { identity: userId }
    );
    
    // Add the voice grant to our token
    token.addGrant(voiceGrant);

    // Generate the token
    const tokenString = token.toJwt();

    return NextResponse.json({ token: tokenString });
  } catch (error) {
    console.error('Error generating Twilio token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
} 