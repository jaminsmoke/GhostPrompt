/**
 * @file Paridad: parseo webview (sandbox) vs schema canónico host → panel.
 */
import * as vitest from 'vitest';

import {
  webviewOutboundInvalidFixtures,
  webviewOutboundValidFixtures,
} from '../../../../system/internals/protocols/validations/schemas/fixtures/webviewOutboundMessageFixtures';
import { webviewOutboundMessageSchema } from '../../../../system/internals/protocols/validations/schemas/zschemWebviewMessages';

import { parseWebviewInboundMessage } from './parseWebviewInbound';

vitest.describe('parseWebviewInbound (host → webview)', () => {
  vitest.it('usa webviewOutboundMessageSchema del contrato canónico', () => {
    const sample = webviewOutboundValidFixtures[0]?.raw;
    const fromSchema = webviewOutboundMessageSchema.safeParse(sample);
    const fromParser = parseWebviewInboundMessage(sample);
    vitest.expect(fromSchema.success).toBe(true);
    if (fromSchema.success) {
      vitest.expect(fromParser).toEqual(fromSchema.data);
    }
  });

  vitest.describe('fixtures válidos (paridad con Zod)', () => {
    vitest.it.each(webviewOutboundValidFixtures.map((fixture) => [fixture.id, fixture.raw]))(
      'acepta %s',
      (_id, raw) => {
        const fromSchema = webviewOutboundMessageSchema.safeParse(raw);
        vitest.expect(fromSchema.success).toBe(true);
        if (!fromSchema.success) {
          return;
        }
        vitest.expect(parseWebviewInboundMessage(raw)).toEqual(fromSchema.data);
      },
    );
  });

  vitest.describe('fixtures inválidos (paridad con Zod)', () => {
    vitest.it('rechaza ausencia de payload', () => {
      vitest.expect(webviewOutboundMessageSchema.safeParse().success).toBe(false);
      vitest.expect(parseWebviewInboundMessage()).toBe(false);
    });

    vitest.it.each(
      webviewOutboundInvalidFixtures.map((raw, index) => [`#${index}`, raw] as const),
    )('rechaza %s', (_label, raw) => {
      vitest.expect(webviewOutboundMessageSchema.safeParse(raw).success).toBe(false);
      vitest.expect(parseWebviewInboundMessage(raw)).toBe(false);
    });
  });
});
