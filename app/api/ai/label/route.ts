import { NextRequest, NextResponse } from 'next/server';
import { generateAiLabel } from '@/lib/ai/labelGenerator';

export async function POST(request: NextRequest) {
  try {
    const { itemName } = await request.json();

    if (!itemName || typeof itemName !== 'string') {
      return NextResponse.json(
        { error: 'Item name is required' },
        { status: 400 }
      );
    }

    const result = await generateAiLabel(itemName);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Error in AI label API:', error);
    return NextResponse.json(
      { 
        status: 'insufficient_data',
        reason: 'AI service error'
      },
      { status: 500 }
    );
  }
}

