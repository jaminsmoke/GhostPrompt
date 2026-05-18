/**
 * @file Emisor mínimo de eventos con suscripción y `dispose`.
 */

type Listener<T> = (data: T) => void;

/**
 * Emisor síncrono ligero para notificar cambios de estado internos.
 */
export class SimpleEventEmitter<T> {
  private _listeners: Listener<T>[] = [];

  /**
   * Registra un listener y devuelve un disposable que lo elimina.
   * @param {Listener<T>} listener - Callback invocado en cada `fire`.
   * @returns {{ dispose: () => void }} Suscripción cancelable.
   */
  on(listener: Listener<T>): { dispose: () => void } {
    this._listeners.push(listener);
    return {
      dispose: () => {
        this._listeners = this._listeners.filter((entry) => entry !== listener);
      },
    };
  }

  /**
   * Notifica a todos los listeners registrados.
   * @param {T} data - Payload del evento.
   * @returns {void}
   */
  fire(data: T): void {
    for (const listener of this._listeners) {
      listener(data);
    }
  }

  /**
   * Elimina todos los listeners.
   * @returns {void}
   */
  dispose(): void {
    this._listeners = [];
  }
}
