# Suggestion Debug Flow (v0.2)

Esta guia permite diagnosticar por que una suggestion no aparece en la webview.

## 1) Activar debug

1. Abrir la paleta de comandos.
2. Ejecutar `GhostPrompt: Toggle Debug`.
3. Verificar en Settings que `ghostPrompt.debugSuggestions` quede en `true`.

## 2) Abrir canal de salida

1. Abrir `View -> Output`.
2. Seleccionar canal `GhostPrompt Suggestions`.

## 3) Leer trazas por `captureId`

Cada solicitud queda trazada asi:

- `request-start`: inicio de solicitud con policy y longitud de input.
- `request-success`: suggestion final enviada a webview.
- `request-empty`: no hay suggestion (`no-model`, `no-included-model`, `empty-response`, `premium-quota-blocked`).
- `request-error`: error real devuelto por la API.
- `request-discarded`: respuesta tardia descartada por `captureId` o cancelacion.
- `request-cancelled`: request cancelada porque el usuario siguio escribiendo.

## 4) Casos comunes y accion recomendada

- `reason=no-model`: revisar sesion de Copilot (login/extension).
- `reason=no-included-model`: cambiar policy a `anyModel` o mantener modo seguro.
- `reason=premium-quota-blocked`: se detecto error premium en modo seguro; suggestions pausadas en sesion.
- muchos `request-discarded`: latencia alta + tecleo rapido; subir debounce o reducir carga.

## 5) Ajustes operativos

- `ghostPrompt.suggestionModelPolicy`:
  - `nonPremiumOnly` (seguro, default)
  - `anyModel` (puede consumir premium)
- `ghostPrompt.maxSuggestionChars`: controla largo de suggestion final normalizada.
