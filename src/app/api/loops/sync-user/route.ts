import { NextRequest, NextResponse } from 'next/server';

const LOOPS_API_KEY = process.env.LOOPS_API_KEY || '';
const LOOPS_CONTACT_CREATE_ENDPOINT = 'https://app.loops.so/api/v1/contacts/create';

/**
 * API endpoint to sync a user to Loops
 * POST /api/loops/sync-user
 * Body: { email: string, uid: string, firstName?: string, lastName?: string }
 */
export async function POST(request: NextRequest) {
  console.log(`[API] Starting Loops sync API, API Key present: ${Boolean(LOOPS_API_KEY)}, Length: ${LOOPS_API_KEY?.length || 0}`);
  
  try {
    // Validate API key presence
    if (!LOOPS_API_KEY) {
      console.error('[API] Loops API key is missing in environment variables.');
      return NextResponse.json(
        { success: false, message: 'Server configuration error' }, 
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email, uid, firstName, lastName } = body;

    // Validate required fields
    if (!email || !uid) {
      console.error('[API] Missing required fields for Loops sync');
      return NextResponse.json(
        { success: false, message: 'Email and User ID are required' }, 
        { status: 400 }
      );
    }

    console.log(`[API] Syncing user to Loops - Email: ${email}, UID: ${uid}`);

    // Prepare payload for Loops API
    const payload: {
      email: string;
      userId: string;
      source: string;
      firstName?: string;
      lastName?: string;
    } = {
      email: email,
      userId: uid,
      source: 'app_customer'
    };
    
    if (firstName) payload.firstName = firstName;
    if (lastName) payload.lastName = lastName;
    
    console.log('[API] Loops payload:', JSON.stringify(payload));

    // Call Loops API with explicit headers
    console.log('[API] Sending request to Loops API with key length:', LOOPS_API_KEY.length);
    const response = await fetch(LOOPS_CONTACT_CREATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOOPS_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // Log response details for debugging
    console.log('[API] Loops response status:', response.status);
    console.log('[API] Loops response status text:', response.statusText);
    
    let responseText;
    try {
      responseText = await response.text();
      console.log('[API] Raw response from Loops:', responseText);
      
      // Try to parse JSON if possible
      if (responseText && responseText.trim()) {
        const data = JSON.parse(responseText);
        console.log('[API] Parsed response from Loops:', data);
        
        if (response.ok) {
          console.log('[API] Successfully synced user to Loops');
          return NextResponse.json({ 
            success: true,
            message: 'User synced to Loops successfully'
          });
        }
      }
    } catch (parseError) {
      console.error('[API] Error parsing Loops response:', parseError);
    }

    // Handle error cases
    console.error('[API] Failed to sync user to Loops. Status:', response.status);
    console.error('[API] Response text:', responseText || 'No response body');
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to sync user to Loops', 
        status: response.status,
        response: responseText
      }, 
      { status: 500 }
    );
  } catch (error) {
    console.error('[API] Exception processing request:', error);
    return NextResponse.json(
      { success: false, message: 'Server error processing request' },
      { status: 500 }
    );
  }
} 