# BlockBlast 2 - Multiplayer Block Game

A multiplayer block-based puzzle game built with Next.js, React, and Socket.IO.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deploying to Vercel

This application uses Socket.IO for real-time multiplayer functionality. Deploying to Vercel requires special handling of WebSocket connections since Vercel primarily supports serverless functions.

### Deploy Steps:

1. Push your code to a Git repository
2. Connect the repository to Vercel
3. Add the following environment variables in Vercel project settings:
   - `NEXT_PUBLIC_USING_VERCEL=true`

### Important Notes for Vercel Deployment:

The multiplayer functionality uses a Socket.IO implementation specifically adapted for Vercel's serverless environment:

- In-memory state for rooms and game data is reset on any server redeployment
- Each Socket.IO connection is initialized with a POST request to the API route
- WebSocket connections are maintained through special Vercel configuration
- The Socket.IO path is set to `/api/socket/io`

### Troubleshooting Multiplayer Issues:

If you see "Connecting to server..." and the connection doesn't complete:

1. Check browser console for any connection errors
2. Ensure the Socket.IO routes are properly set up in the middleware
3. Try refreshing the page to reinitialize the Socket.IO connection
4. Clear browser cache and cookies if issues persist

## Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Vercel Deployment Documentation](https://vercel.com/docs)
