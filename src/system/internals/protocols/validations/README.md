# `protocols/validations/` — Validación de contratos

> Familia para **comprobar** datos del protocolo (wire, mensajes). Hoy el único mecanismo es **Zod** bajo `schemas/`; si aparecen otros (JSON Schema, reglas generadas, etc.), conviven aquí en subcarpetas paralelas.

## `schemas/`

Solo definiciones `z.*` e inferencias `z.infer` — **sin** `safeParse` con logging, **sin** imports de VS Code. Los parsers del boundary siguen en `api/protocols/` (u otro host) importando estos módulos. Los tests Zod co-localizados viven en `schemas/*.test.ts` (pueden importar `api/protocols` solo para comprobar identidad de schema con el host).
