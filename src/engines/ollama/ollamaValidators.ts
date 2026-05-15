import { z } from 'zod';

export const ollamaModelSchema = z.object({
  name: z.string(),
  modified_at: z.string(),
  size: z.number(),
  digest: z.string(),
  details: z
    .object({
      format: z.string(),
      family: z.string(),
      families: z.array(z.string()),
      parameter_size: z.string(),
      quantization_level: z.string(),
    })
    .optional(),
});

export const ollamaTagsResponseSchema = z.object({
  models: z.array(z.unknown()).optional(),
});

export const ollamaGenerateResponseSchema = z.object({
  model: z.string(),
  created_at: z.string().optional(),
  response: z.string().optional(),
  done: z.boolean().optional(),
  context: z.array(z.number()).optional(),
  total_duration: z.number().optional(),
  load_duration: z.number().optional(),
  prompt_eval_count: z.number().optional(),
  prompt_eval_duration: z.number().optional(),
  eval_count: z.number().optional(),
  eval_duration: z.number().optional(),
});

export const ollamaGenerateResponseChunkSchema = z.object({
  response: z.string().optional(),
}).passthrough();
