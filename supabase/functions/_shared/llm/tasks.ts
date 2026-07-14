export type DeepSeekModel = 'deepseek-v4-flash' | 'deepseek-chat' | 'deepseek-reasoner';

export type TaskConfig =
  | {
      readonly model: 'deepseek-chat';
      readonly temperature?: number | null;
      readonly maxTokens?: number | null;
      readonly timeoutMs?: number;
      readonly responseFormat?: { readonly type: 'json_object' };
    }
  | {
      readonly model: 'deepseek-v4-flash' | 'deepseek-reasoner';
      readonly temperature?: number | null;
      readonly maxTokens?: number | null;
      readonly timeoutMs?: number;
      readonly responseFormat?: never;
    };

export const LLM_TASKS = {
  classify: {
    model: 'deepseek-v4-flash',
    temperature: 0.1,
  },
  synthesis: {
    model: 'deepseek-v4-flash',
    temperature: 0.3,
    maxTokens: 2500,
  },
  structured: {
    model: 'deepseek-chat',
    temperature: 0.1,
    responseFormat: { type: 'json_object' },
  },
  deep: {
    model: 'deepseek-reasoner',
  },
  oracle: {
    model: 'deepseek-v4-flash',
    temperature: 0.7,
  },
} as const;

type AssertTaskConfig<T extends Record<string, TaskConfig>> = T;
type _Assert = AssertTaskConfig<typeof LLM_TASKS>;
