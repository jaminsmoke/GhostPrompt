/**
 * @file Mock de `vscode.CancellationTokenSource` para tests inbound.
 */

/** Mock de `vscode.CancellationTokenSource` para tests. */
export class MockCancellationTokenSource {
  public token = { isCancellationRequested: false };

  /**
   * Marca el token como cancelado.
   * @returns {void}
   */
  public cancel(): void {
    this.token.isCancellationRequested = true;
  }

  /**
   * No-op de dispose del mock.
   * @returns {void}
   */
  public dispose(): void {
    /* no-op */
  }
}
