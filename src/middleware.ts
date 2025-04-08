import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware for handling public routes and Twilio webhooks
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Log all requests to debug routing issues
  console.log(`[Middleware] Processing request for: ${pathname}`);
  
  // Explicitly allow these paths without auth
  const publicPaths = [
    '/api/twilio-status-callback',
    '/api/twilio-public-callback',
    '/api/voice'
  ];
  
  // Check if the request is for a public path
  if (publicPaths.some(path => pathname.startsWith(path))) {
    console.log(`[Middleware] Allowing public access to: ${pathname}`);
    
    // Pass through the request without auth
    return NextResponse.next({
      headers: {
        // Add bypass headers that might help with internal auth systems
        'x-middleware-bypass': 'true',
        'x-bypass-auth': 'true'
      }
    });
  }
  
  // Continue with default behavior for all other routes
  return NextResponse.next();
}

// Configure paths that this middleware should run on
export const config = {
  matcher: [
    // Apply to all API routes
    '/api/:path*',
  ],
}; 