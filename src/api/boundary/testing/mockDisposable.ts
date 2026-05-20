/**
 * @file Mock de `vscode.Disposable` para tests inbound.
 */

/** Mock de `vscode.Disposable` para tests. */
export class MockDisposable {
  /**
   * Crea un disposable de prueba.
   * @param {() => void} disposeFunction - Función ejecutada al disponer.
   */
  constructor(private readonly disposeFunction: () => void) {}

  /**
   * Ejecuta la función de limpieza registrada.
   * @returns {void}
   */
  public dispose(): void {
    this.disposeFunction();
  }
}
