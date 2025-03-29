import { NextRequest, NextResponse } from 'next/server';
import { getRandomPhoneNumberFromPool, makeCall } from '@/lib/twilio';
import { adminAuth } from '@/lib/firebase-admin';

// API route for initiating calls
export async function POST(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization token' }, { status: 401 });
    }

    // Verify Firebase token
    const token = authHeader.split('Bearer ')[1];
    try {
      await adminAuth.verifyIdToken(token);
    } catch (error) {
      console.error('Invalid Firebase token:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { to } = body;

    // Validate the 'to' number
    if (!to || !to.match(/^\+[1-9]\d{1,14}$/)) {
      return NextResponse.json(
        { error: 'Invalid phone number. Must be in E.164 format (e.g., +14155552671)' },
        { status: 400 }
      );
    }

    // Get a number from our pool to use as the 'from' number
    const from = await getRandomPhoneNumberFromPool();

    // Make the call using Twilio
    const callSid = await makeCall(to, from);

    // Return success response with call details
    return NextResponse.json({ 
      success: true, 
      callSid,
      from,
      to,
      timestamp: new Date().toISOString()
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error initiating call:', error);
    
    return NextResponse.json({ 
      error: error.message || 'Failed to initiate call' 
    }, { status: 500 });
  }
}

// For debugging in development - list available phone numbers
export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  
  try {
    const from = await getRandomPhoneNumberFromPool();
    return NextResponse.json({ availableNumber: from }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 