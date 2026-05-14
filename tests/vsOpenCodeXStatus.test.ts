import { describe, expect, it, vi } from 'vitest';

const getExtensionMock = vi.hoisted(() => vi.fn());
vi.mock('vscode', () => ({
  extensions: { getExtension: getExtensionMock },
}));

import { vsOpenCodeXStatusModule } from '../src/destinations/vsOpenCodeX/vsOpenCodeXStatus';

describe('vsOpenCodeXStatusModule', () => {
  it('retorna running si extensión está instalada', async () => {
    getExtensionMock.mockReturnValue({ id: 'jaminsmoke.vsopencodex' });
    const state = await vsOpenCodeXStatusModule.check();
    expect(state.status).toBe('running');
    expect(state.statusText).toBe('Extensión instalada');
  });

  it('retorna unavailable si extensión no está instalada', async () => {
    getExtensionMock.mockReturnValue(undefined);
    const state = await vsOpenCodeXStatusModule.check();
    expect(state.status).toBe('unavailable');
    expect(state.statusText).toBe('Extensión no instalada');
  });
});
