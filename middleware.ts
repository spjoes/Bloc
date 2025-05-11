import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Allow socket.io requests to pass through
  if (request.nextUrl.pathname.startsWith('/api/socket')) {
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

// Configure matcher to run this middleware only for specific paths
export const config = {
  matcher: [
    // Match all API routes except socket endpoints
    '/api/((?!socket).*)',
    // Match socket.io paths
    '/api/socket/:path*',
  ],
}; 