import { NextRequest, NextResponse } from 'next/server';

/**
 * POST handler for updating all pricing data
 * This endpoint is now just a stub that redirects to the CSV import
 * as we've replaced Twilio API with CSV import
 */
export async function POST(request: NextRequest) {
  try {
    // Basic authentication check
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }
    
    const token = authHeader.split(' ')[1];
    
    // Check against environment variable
    const adminSecret = process.env.ADMIN_API_SECRET;
    
    if (!adminSecret || token !== adminSecret) {
      return NextResponse.json(
        { error: 'Invalid token' }, 
        { status: 401 }
      );
    }
    
    // Inform the user that they should use the CSV import instead
    return NextResponse.json({
      success: false,
      message: 'This endpoint is deprecated. Please use the CSV import feature to update pricing data.',
      redirectTo: '/admin/pricing'
    }, { status: 307 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in pricing update endpoint:', error);
    return NextResponse.json(
      { 
        success: false,
        error: `An error occurred: ${errorMessage}` 
      }, 
      { status: 500 }
    );
  }
} 