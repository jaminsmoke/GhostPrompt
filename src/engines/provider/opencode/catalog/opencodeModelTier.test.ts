/**
 * @file Pruebas de clasificación de tiers de OpenCode.
 */
import { describe, expect, it } from 'vitest';

import { classifyOpencodeModelTier } from './opencodeModelTier';

describe('classifyOpencodeModelTier', () => {
  it('0x pricing → included', () => {
    const r = classifyOpencodeModelTier('openai', 'gpt', 'G', {
      pricing: '0x',
    });
    expect(r.tier).toBe('included');
    expect(r.pricing).toBe('0x');
  });

  it('1x pricing → premium', () => {
    const r = classifyOpencodeModelTier('openai', 'gpt', 'G', {
      pricing: '1x',
    });
    expect(r.tier).toBe('premium');
  });

  it('proveedor opencode (local) → included', () => {
    const r = classifyOpencodeModelTier('opencode', 'big-pickle', 'Big', {});
    expect(r.tier).toBe('included');
  });

  it('ollama → included', () => {
    const r = classifyOpencodeModelTier('ollama', 'llama3', 'Llama', {});
    expect(r.tier).toBe('included');
  });

  it('anthropic claude-3 sin señales → unknown', () => {
    const r = classifyOpencodeModelTier('anthropic', 'claude-3', 'Claude 3', {});
    expect(r.tier).toBe('unknown');
  });
});
