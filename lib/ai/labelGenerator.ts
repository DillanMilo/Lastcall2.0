import OpenAI from 'openai';
import { AILabelResult } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * Generates an AI label for an inventory item based on its name.
 * Returns a structured response that indicates success or insufficient data.
 * 
 * @param itemName - The name of the inventory item
 * @returns Promise<AILabelResult> - Label result with status and details
 */
export async function generateAiLabel(itemName: string): Promise<AILabelResult> {
  if (!itemName || itemName.trim().length === 0) {
    return {
      status: 'insufficient_data',
      reason: 'Item name is empty or invalid',
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that categorizes inventory items for retail businesses.
Your task is to analyze product names and provide:
1. A category (e.g., "meat", "snack", "beverage", "produce", "dairy", "packaged_goods", "other")
2. A recommended reorder frequency (e.g., "daily", "weekly", "biweekly", "monthly")
3. A confidence score (0-100)

If you cannot determine a reasonable category from the product name, respond with:
{"status": "insufficient_data", "reason": "Unable to classify product"}

Otherwise respond with:
{"status": "success", "category": "<category>", "label": "<frequency>", "confidence": <score>}

Never hallucinate or guess wildly. Only classify if you have reasonable confidence.`,
        },
        {
          role: 'user',
          content: `Classify this inventory item: "${itemName}". Respond in JSON format.`,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        status: 'insufficient_data',
        reason: 'No response from AI model',
      };
    }

    const result = JSON.parse(content) as AILabelResult;
    return result;
  } catch (error) {
    console.error('Error generating AI label:', error);
    return {
      status: 'insufficient_data',
      reason: 'AI service error',
    };
  }
}

