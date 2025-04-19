import { NextRequest, NextResponse } from 'next/server';
import { MarkupConfig } from '@/types/pricing';
import { saveMarkupConfig } from '@/lib/pricing/pricing-db-admin'; // Import from admin DB file

/**
 * POST handler for updating markup configuration
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication Check (Admin Token)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const adminSecret = process.env.ADMIN_API_SECRET;
    if (!adminSecret || token !== adminSecret) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    // 2. Parse Request Body
    const configData = await request.json() as MarkupConfig;

    // 3. Optional: Validate data structure if needed
    if (!configData || typeof configData.defaultMarkup !== 'number') {
       return NextResponse.json({ error: 'Invalid markup configuration data' }, { status: 400 });
    }

    // 4. Save Configuration using Admin SDK function
    const success = await saveMarkupConfig(configData);

    if (success) {
      return NextResponse.json({ success: true, message: 'Markup configuration saved.' });
    } else {
      throw new Error('Failed to save markup configuration in database.');
    }

  } catch (error) {
    console.error('Error saving markup configuration:', error);
    const errorMessage = error instanceof Error ? error.message : 'An internal server error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
} 