import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Special handling for socket.io connections
  if (
    request.nextUrl.pathname.startsWith('/api/socket') ||
    request.nextUrl.pathname.includes('/socket.io')
  ) {
    // For socket.io requests, we need to pass them through without modification
    // This includes the initial HTTP request and the WebSocket upgrade
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

// Configure matcher to run this middleware only for specific paths
export const config = {
  matcher: [
    // Match socket.io paths
    '/api/socket/:path*',
    '/socket.io/:path*',
  ],
}; 