import { NextRequest, NextResponse } from 'next/server';

interface LogEvent {
  event: string;
  data: any;
  timestamp?: string;
}

export async function GET() {
  // Handle GET requests - return empty 200 OK response
  return NextResponse.json({ message: 'Logging endpoint is active' });
}

export async function POST(request: NextRequest) {
  try {
    const body: LogEvent = await request.json();
    
    // Add timestamp if not provided
    const eventData = {
      ...body,
      timestamp: body.timestamp || new Date().toISOString()
    };

    // This will show in Vercel deployment logs
    console.log('[Client Event]', {
      ...eventData,
      // Add request metadata
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      ip: request.headers.get('x-forwarded-for')
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Log API Error]', error);
    return NextResponse.json(
      { error: 'Failed to log event' },
      { status: 500 }
    );
  }
}