/**
 * @file Utilidades para valores opcionales sin literales `undefined` ni `null`.
 */

const absentValue = Symbol('absent');

type ConfigurationInspectScopes = {
  globalValue?: unknown;
  workspaceValue?: unknown;
  workspaceFolderValue?: unknown;
};

/**
 * Indica si un valor está definido (no es `null` ni `undefined`).
 * @param {unknown} value - Valor a comprobar.
 * @returns {value is NonNullable<unknown>} `true` si el valor está presente.
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return (value ?? absentValue) !== absentValue;
}

/**
 * Indica si `inspect()` tiene un valor explícito en algún ámbito de VS Code.
 * @param {ConfigurationInspectScopes | undefined} inspected - Resultado de `inspect()`.
 * @returns {boolean} `true` si hay valor en global, workspace o carpeta.
 */
export function hasAnyConfigurationInspectScope(
  inspected: ConfigurationInspectScopes | undefined,
): boolean {
  if (!inspected) {
    return false;
  }
  return (
    isDefined(inspected.globalValue) ||
    isDefined(inspected.workspaceValue) ||
    isDefined(inspected.workspaceFolderValue)
  );
}

/**
 * Elimina una propiedad opcional de un objeto sin asignar `undefined`.
 * @param {object} target - Objeto destino.
 * @param {PropertyKey} key - Clave a eliminar.
 * @returns {void}
 */
export function clearOptionalProperty(target: object, key: PropertyKey): void {
  Reflect.deleteProperty(target, key);
}
