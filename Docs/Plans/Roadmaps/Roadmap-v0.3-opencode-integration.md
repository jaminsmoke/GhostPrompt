# Roadmap — Integración opcional OpenCode (complemento a v0.3.0)

> **Estado:** Borrador — afinar después de cerrar la [reestructuración `src`](./Roadmap-v0.3.0-architecture.md).  
> **Propósito:** Ofrecer **suggestions** usando el stack OpenCode (SDK / servidor / modelos gratuitos con restricciones del proveedor) como **alternativa opt-in** a Copilot `vscode.lm`, útil si la facturación o límites de VS Code/Copilot cambian (p. ej. evolución hacia uso medido).

## Principios de producto

1. **Por defecto:** Copilot LM (`vscode.lm`) — comportamiento actual.
2. **Opt-in explícito:** setting del tipo `ghostPrompt.completionProvider` (`copilot` | `opencode`, nombres definitivos al implementar).
3. **Transparencia:** mensajes claros si OpenCode no está instalado, no arranca o el modelo elegido no es “gratis”; el gratis depende del **proveedor/modelo** en OpenCode, no de GhostPrompt.
4. **Sin duplicar política de precios:** enlazar documentación OpenCode / proveedor donde sea necesario.

## Trabajo técnico (esqueleto — completar tras spike)

- [ ] Spike: `@opencode-ai/sdk` o API HTTP del daemon OpenCode según documentación vigente.
- [ ] Implementar `CompletionProvider` “OpenCode” que respete cancelación y límites del `SuggestionRequestGovernor`.
- [ ] UI webview: selector o reflejo del proveedor activo (evitar confusión con chips de modelo Copilot cuando el backend sea OpenCode).
- [ ] Tests: mocks del cliente OpenCode; sin llamadas de red en CI.

## Dependencias y empaquetado

- Evaluar tamaño del VSIX y activación diff si se añade SDK.
- Documentar prerequisitos en README (CLI OpenCode, configuración de modelo, etc.).

## Integración futura (otro proyecto)

Extensión UI dedicada a OpenCode en VS Code: GhostPrompt podría detectar presencia o comandos expuestos; **no bloquea** la primera integración “directa” vía OpenCode runtime del usuario.

## Definición de hecho (cuando se active este roadmap)

- Setting + proveedor OpenCode funcional en escenarios documentados.
- `npm run check` verde.
- Entrada en CHANGELOG y README (sección proveedores).
