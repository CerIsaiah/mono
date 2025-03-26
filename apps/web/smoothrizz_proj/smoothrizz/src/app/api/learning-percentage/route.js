import { NextResponse } from 'next/server';
import { getLearningPercentage } from '@/utils/usageTracking';

export async function GET(request) {
  try {
    const userEmail = request.headers.get('x-user-email');
    const result = await getLearningPercentage(userEmail);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in learning-percentage route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 