import OpenAI from 'openai';
import { ItemHistory, ReorderPrediction } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * Predicts the next reorder date for an inventory item based on historical data.
 * 
 * @param itemHistory - Array of historical item transactions
 * @returns Promise<ReorderPrediction> - Prediction result with status and details
 */
export async function predictReorderDate(
  itemHistory: ItemHistory[]
): Promise<ReorderPrediction> {
  if (!itemHistory || itemHistory.length < 3) {
    return {
      status: 'insufficient_data',
      reason: 'Need at least 3 historical data points to predict reorder date',
    };
  }

  try {
    const historyString = JSON.stringify(itemHistory, null, 2);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that predicts inventory reorder dates based on historical usage patterns.

Analyze the provided historical data and predict when the next reorder should occur.
Consider:
- Rate of consumption (sales + waste)
- Restock frequency patterns
- Current quantity trends

If there is insufficient data or inconsistent patterns, respond with:
{"status": "insufficient_data", "reason": "<explanation>"}

Otherwise respond with:
{"status": "success", "predicted_date": "YYYY-MM-DD", "confidence": <0-100>}

Never hallucinate dates. Base predictions strictly on observable patterns.`,
        },
        {
          role: 'user',
          content: `Analyze this item history and predict the next reorder date:\n${historyString}`,
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        status: 'insufficient_data',
        reason: 'No response from AI model',
      };
    }

    const result = JSON.parse(content) as ReorderPrediction;
    return result;
  } catch (error) {
    console.error('Error predicting reorder date:', error);
    return {
      status: 'insufficient_data',
      reason: 'AI service error',
    };
  }
}

