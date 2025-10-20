import { AILabelResult } from '@/types';

/**
 * Client-side wrapper for AI label generation
 * Calls the server-side API route instead of OpenAI directly
 * 
 * @param itemName - The name of the inventory item
 * @returns Promise<AILabelResult> - Label result with status and details
 */
export async function generateAiLabelClient(itemName: string): Promise<AILabelResult> {
  if (!itemName || itemName.trim().length === 0) {
    return {
      status: 'insufficient_data',
      reason: 'Item name is empty or invalid',
    };
  }

  try {
    const response = await fetch('/api/ai/label', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ itemName }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate AI label');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error calling AI label API:', error);
    return {
      status: 'insufficient_data',
      reason: 'AI service unavailable',
    };
  }
}

