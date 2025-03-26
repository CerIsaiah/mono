import { NextResponse } from 'next/server';

export async function GET() {
  // Use the server-side environment variable
  const clientId = process.env.GOOGLE_CLIENT_ID;
  
  console.log('Debug - Google Client ID Check:', {
    exists: !!clientId,
    timestamp: new Date().toISOString()
  });

  if (!clientId) {
    return NextResponse.json({ 
      error: 'Google Client ID not configured',
      envVars: Object.keys(process.env).filter(key => key.includes('GOOGLE'))
    }, { status: 500 });
  }
  
  return NextResponse.json({ clientId });
} 