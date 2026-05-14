import { describe, expect, it, vi } from 'vitest';
import { copilotStatusModule } from '../src/engines/copilot/copilotStatus';
import { copilotChatStatusModule } from '../src/destinations/copilotChat/copilotChatStatus';

describe('copilotStatusModule', () => {
  it('retorna siempre running', async () => {
    const state = await copilotStatusModule.check();
    expect(state.status).toBe('running');
    expect(state.label).toBe('Copilot LM');
    expect(state.id).toBe('copilot');
    expect(state.kind).toBe('engine');
  });
});

describe('copilotChatStatusModule', () => {
  it('retorna siempre running', async () => {
    const state = await copilotChatStatusModule.check();
    expect(state.status).toBe('running');
    expect(state.label).toBe('Copilot Chat');
    expect(state.id).toBe('copilotChat');
    expect(state.kind).toBe('destination');
  });
});
