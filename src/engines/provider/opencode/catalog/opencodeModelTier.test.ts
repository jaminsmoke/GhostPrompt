/**
 * @file Pruebas de clasificación de tiers de OpenCode.
 */
import * as vitest from 'vitest';

import { classifyOpencodeModelTier } from './opencodeModelTier';

vitest.describe('classifyOpencodeModelTier', () => {
  vitest.it('0x pricing → included', () => {
    const r = classifyOpencodeModelTier('openai', 'gpt', 'G', {
      pricing: '0x',
    });
    vitest.expect(r.tier).toBe('included');
    vitest.expect(r.pricing).toBe('0x');
  });

  vitest.it('1x pricing → premium', () => {
    const r = classifyOpencodeModelTier('openai', 'gpt', 'G', {
      pricing: '1x',
    });
    vitest.expect(r.tier).toBe('premium');
  });

  vitest.it('proveedor opencode (local) → included', () => {
    const r = classifyOpencodeModelTier('opencode', 'big-pickle', 'Big', {});
    vitest.expect(r.tier).toBe('included');
  });

  vitest.it('ollama → included', () => {
    const r = classifyOpencodeModelTier('ollama', 'llama3', 'Llama', {});
    vitest.expect(r.tier).toBe('included');
  });

  vitest.it('anthropic claude-3 sin señales → unknown', () => {
    const r = classifyOpencodeModelTier('anthropic', 'claude-3', 'Claude 3', {});
    vitest.expect(r.tier).toBe('unknown');
  });
});
