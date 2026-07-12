import { z } from "npm:zod";

export const OracleResponseSchema = z.object({
  answer: z.string().optional(),
  text: z.string().optional(),
  odpowiedz: z.string().optional(),
  odpowiedź: z.string().optional(),
  response: z.string().optional(),
  content: z.string().optional(),
  message: z.string().optional(),
  confidence: z.string().optional(),
  intent_confirmed: z.string().optional(),
  claims: z.array(z.any()).optional(),
  clarification_request: z.any().optional(),
  schedule_mutation: z.any().optional(),
  insight_cards_mutation: z.any().optional(),
  mint_fact_id: z.boolean().optional()
}).catchall(z.any());

export function extractAnswer(structuredResponse: any, rawOutput: string): string {
  const answer = 
    structuredResponse.answer || 
    structuredResponse.text || 
    structuredResponse.odpowiedz || 
    structuredResponse.odpowiedź || 
    structuredResponse.response || 
    structuredResponse.content ||
    structuredResponse.message;

  if (typeof answer === 'string' && answer.trim()) {
    return answer.trim();
  }
  
  if (answer !== undefined && answer !== null) {
    if (typeof answer === 'object') {
      return JSON.stringify(answer);
    }
    return String(answer).trim();
  }

  const trimmedRaw = rawOutput?.trim();
  if (trimmedRaw) {
    if (trimmedRaw.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmedRaw);
        for (const val of Object.values(parsed)) {
          if (typeof val === 'string' && val.trim().length > 10) {
            return val.trim();
          }
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }
    return trimmedRaw;
  }

  return "Błąd generowania odpowiedzi.";
}
