/**
 * @file Coordinación de peticiones de suggestion en vuelo (captureId + cancelación).
 */
import * as vscode from 'vscode';

/**
 * Gestiona el captureId activo y el token de cancelación de la suggestion en curso.
 */
export class SuggestionRequestCoordinator {
  private _activeCaptureId = 0;
  private _activeSuggestionToken?: vscode.CancellationTokenSource;

  /**
   * Devuelve el captureId de la petición de suggestion considerada vigente.
   * @returns {number} Identificador de captura activo.
   */
  getActiveCaptureId(): number {
    return this._activeCaptureId;
  }

  /**
   * Indica si un captureId sigue siendo la petición activa (no sustituida por otra más nueva).
   * @param {number} captureId - Identificador de captura a comprobar.
   * @returns {boolean} True si coincide con el capture activo.
   */
  isActiveCapture(captureId: number): boolean {
    return captureId === this._activeCaptureId;
  }

  /**
   * Cancela la petición anterior, fija el captureId activo y devuelve un token nuevo.
   * @param {number} captureId - Identificador de la captura actual de sugerencia.
   * @returns {vscode.CancellationTokenSource} Token de cancelación para la solicitud en curso.
   */
  prepareRequest(captureId: number): vscode.CancellationTokenSource {
    this._activeSuggestionToken?.cancel();
    this._activeSuggestionToken?.dispose();
    const tokenSource = new vscode.CancellationTokenSource();
    this._activeSuggestionToken = tokenSource;
    this._activeCaptureId = captureId;
    return tokenSource;
  }

  /**
   * Libera el token si sigue siendo el activo.
   * @param {vscode.CancellationTokenSource} tokenSource - Token devuelto por `prepareRequest`.
   */
  disposeTokenIfActive(tokenSource: vscode.CancellationTokenSource): void {
    if (this._activeSuggestionToken === tokenSource) {
      this._activeSuggestionToken = undefined;
      tokenSource.dispose();
    }
  }

  /**
   * Reinicia capture y cancelación (tests y teardown).
   */
  reset(): void {
    this._activeSuggestionToken?.cancel();
    this._activeSuggestionToken?.dispose();
    this._activeSuggestionToken = undefined;
    this._activeCaptureId = 0;
  }
}

/** Singleton compartido por el pipeline de suggestion. */
export const suggestionRequestCoordinator = new SuggestionRequestCoordinator();
