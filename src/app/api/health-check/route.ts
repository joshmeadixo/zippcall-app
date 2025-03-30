import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Return a simple success response
    return NextResponse.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      server: 'running'
    });
  } catch (err) {
    console.error('Health check error:', err);
    return NextResponse.json(
      { status: 'error', message: 'Health check failed' },
      { status: 500 }
    );
  }
} 