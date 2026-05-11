# Coexistencia OpenCode: GhostPrompt ↔ VSOpenCodeX

Objetivo: evitar **dos procesos** `opencode serve` en el mismo puerto cuando el usuario tiene **GhostPrompt** y **VSOpenCodeX**. Los cambios de comportamiento viven **en el repositorio GhostPrompt**; este documento es la especificación para implementarlos allí. En VSOpenCodeX ya existe un contrato por **comandos** (este repo).

**Roadmap planificado (versión 0.5.0):** [`Roadmap-v0.5-vsopencodex-coexistence.md`](../Plans/Roadmaps/Roadmap-v0.5-vsopencodex-coexistence.md). **Motor vs destino vs superficie:** [`GhostPrompt-motor-destino-matrix.md`](./GhostPrompt-motor-destino-matrix.md) — con destino VSOpenCodeX el Send vive en VSX; GhostPrompt desactiva solo inline/send Copilot en su webview y mantiene configuración.

---

## Qué expone VSOpenCodeX (hecho en este repo)

| Comando VS Code | Retorno | Notas |
|-----------------|--------|--------|
| `vsopencodex.getOpenCodeConnection` | Ver tipo abajo | Solo tiene sentido si VSOpenCodeX **ya** arrancó su servidor (p. ej. usuario abrió el chat). |
| `vsopencodex.isOpenCodeRunning` | `boolean` | Comprobación rápida sin credenciales. |

Están **ocultos de la paleta** (`when: false` en `commandPalette`) pero **sí** se pueden invocar con `vscode.commands.executeCommand`.

### Forma de `vsopencodex.getOpenCodeConnection`

Éxito:

```ts
{
  ok: true,
  baseUrl: string,           // p.ej. "http://127.0.0.1:17433"
  authorizationHeader: string, // "Basic …" listo para fetch/SDK
  port: number
}
```

Fallo (servidor no iniciado por VSOpenCodeX, etc.):

```ts
{
  ok: false,
  reason: string
}
```

Uso con el SDK (igual que en la documentación oficial de OpenCode, más cabecera):

```ts
import { createOpencodeClient } from "@opencode-ai/sdk";

const conn = await vscode.commands.executeCommand<
  /* importar tipo desde copia local o definir inline */
  { ok: true; baseUrl: string; authorizationHeader: string; port: number } | { ok: false; reason: string }
>("vsopencodex.getOpenCodeConnection");

if (conn && conn.ok) {
  const client = createOpencodeClient({
    baseUrl: conn.baseUrl,
    headers: { Authorization: conn.authorizationHeader },
  });
  // …
}
```

**Seguridad:** `authorizationHeader` es un secreto de sesión. No registrarlo en logs ni telemetría.

**Identificación:** solo una respuesta `ok: true` aquí garantiza que la instancia es la gestionada por VSOpenCodeX en esta sesión (con la contraseña embebida correcta). No basta con ver un puerto libre u ocupado.

---

## Tareas para el agente / equipo en el repo GhostPrompt

Implementar una política de arranque **por defecto** en tres fases.

### 1. No arrancar OpenCode inmediatamente

- Desactivar o posponer el arranque automático actual hasta completar las comprobaciones siguientes (o tras configuración explícita del usuario).

### 2. Espera anti-carrera (configurable)

- Tras la activación de la extensión (o el punto donde hoy disparáis el servidor), esperar **500–2000 ms** (valor en `contributes.configuration` recomendado) para dar tiempo a que VSOpenCodeX abra la vista y levante el servidor si el usuario va a usarla primero.

### 3. Decidir si reutilizar servidor

Orden sugerido:

1. Comprobar si la extensión VSOpenCodeX está instalada y activa:  
   `vscode.extensions.getExtension("jaminsmoke.vsopencodex")` (ajustar `publisher.name` si el id real difiere; ver Marketplace / `package.json` de VSOpenCodeX).

2. Llamar `await vscode.commands.executeCommand("vsopencodex.getOpenCodeConnection")`. Si falla (excepción, comando aún no registrado, `ok: false` mientras VSX levanta el servidor), **reintentar** varias veces con pausa entre intentos **antes** de arrancar `opencode serve` embebido, para no ocupar el puerto por defecto y bloquear a VSOpenCodeX. GhostPrompt expone `ghostPrompt.vsOpenCodeXConnectionMaxAttempts` y `ghostPrompt.vsOpenCodeXConnectionRetryGapMs` (además del delay inicial `vsOpenCodeXProbeDelayMs`).

3. Si `result.ok === true`:  
   - **No** lanzar `opencode serve` propio.  
   - Crear el cliente SDK con `baseUrl` + `Authorization` devueltos.  
   - Opcional: mostrar en ajustes un aviso de “usando instancia VSOpenCodeX”.

4. Si `ok === false` **y** la extensión VSOpenCodeX **sí** está instalada y la política es reutilizar VSX:  
   - Reintentar `getOpenCodeConnection` con pausas; **no** arrancar `opencode serve` embebido en el puerto compartido (evitar bloquear el arranque de VSX).  
   - Tras agotar reintentos: error claro al usuario; opción de desactivar **preferVsOpenCodeXOpenCode** para volver al servidor embebido solo en ese caso.

5. Si VSOpenCodeX **no** está instalada: GhostPrompt puede seguir con el arranque embebido habitual (`opencode serve` propio).

### 4. Ajustes y UX

- Añadir opción tipo `ghostprompt.*`: “Reutilizar OpenCode de VSOpenCodeX cuando esté disponible” (por defecto `true` si coincidís con esta política).

- Opción “Retraso antes de comprobar otras extensiones (ms)” para la espera anti-carrera.

### 5. Pruebas manuales

- Solo GhostPrompt: debe seguir funcionando como hasta ahora (tras espera+comprobación, sin VSOpenCodeX → arranque propio).

- Solo VSOpenCodeX: sin GhostPrompt, sin regresiones.

- Ambas: abrir primero VSOpenCodeX chat → luego GhostPrompt debe detectar `getOpenCodeConnection` ok y **no** abrir segundo servidor en el mismo puerto.

- Orden inverso: definir comportamiento (p. ej. GhostPrompt espera; si luego VSOpenCodeX arranca, siguiente uso puede ya colaborar vía comando).

---

## Versión / API estable

- **Publisher / id de extensión:** `jaminsmoke` / `vsopencodex` (confirmar en `package.json` publicado).

- **Comandos:** `vsopencodex.getOpenCodeConnection`, `vsopencodex.isOpenCodeRunning` (versión desde el CHANGELOG de VSOpenCodeX cuando publiquéis la integración).

Si cambiáis el formato de retorno en VSOpenCodeX, subid **semver minor** y documentad en CHANGELOG para que GhostPrompt pueda adaptarse.

---

## Resumen una línea para el PR en GhostPrompt

> Retrasar el arranque de OpenCode, reintentar `vsopencodex.getOpenCodeConnection`; si `ok`, reutilizar ese cliente; si VSX está instalado y sigue fallando, **no** arrancar `opencode serve` embebido en el puerto compartido; si VSX no está instalada, flujo embebido habitual.
