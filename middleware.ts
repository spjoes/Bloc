import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Let all Socket.IO and API socket requests pass through without modification
  return NextResponse.next();
}

// Only run middleware on Socket.IO related paths
export const config = {
  matcher: [
    '/api/socket/:path*',
    '/api/socket',
    '/socket.io/:path*',
  ],
}; 