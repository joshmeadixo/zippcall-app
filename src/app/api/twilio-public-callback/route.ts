import { NextRequest, NextResponse } from 'next/server';

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
        const callDuration = body.CallDuration;
        
        // Get UserId from query param
        const url = new URL(req.url);
        const userId = url.searchParams.get('UserId');
        
        console.log(`PUBLIC CALLBACK Processing: CallSid=${callSid}, Status=${callStatus}, Duration=${callDuration}, UserId=${userId}`);
        
        // Always return 200 OK with CORS headers
        return new NextResponse('<Response/>', {
            status: 200,
            headers: {
                'Content-Type': 'text/xml',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });
    } catch (error) {
        console.error('PUBLIC CALLBACK Error:', error);
        
        // Even on error, return 200 to Twilio
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