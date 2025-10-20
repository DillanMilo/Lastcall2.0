# AI Integration Guidelines for LastCall 2.0

- AI functions live in `/lib/ai/`.
- Use **OpenAI API (gpt-4o-mini)** for labeling and reorder prediction.
- Functions:
  - `generateAiLabel(itemName: string): Promise<string>`
  - `predictReorderDate(itemHistory: ItemHistory[]): Promise<string>`
- The model must NEVER hallucinate.
- If insufficient context, return:
  ```json
  { "status": "insufficient_data", "reason": "missing historical data" }
  ```
- Always sanitize and validate model inputs.
- Responses must be deterministic and explainable.
- AI outputs are suggestions only; they do not overwrite user data automatically.

