# Roadmaps v0.6

Planificación de la versión **0.6** centrada en la **reorganización de owners** del dominio de suggestions y la clarificación de capas: **core**, **system**, **engines**, **destinations** y **api**.

## Documentos

| Orden | Documento                                                              | Descripción                                                                                                           |
| ----- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1     | [01-core-domain-reorganization.md](./01-core-domain-reorganization.md) | Taxonomía de capas, estructura objetivo de `core/`, fases de trabajo, criterios de aceptación y decisiones pendientes |

## Contexto

La v0.5 ya movió piezas (`host/` → `api/`, `projectMemory/` → `core/memory/`, etc.). La v0.6 prioriza **delimitar responsabilidades** y **reducir acoplamiento** en el barrel `core/index.ts`, alineado con el valor del producto (suggestions) frente a infraestructura transversal.

## Estado

- **Hito v0.6.0 (owners + barrel + docs)** publicado en repo. La **reorganización de carpetas** dentro de `core/` (layout tipo `suggest/`, `routing/`…) está **pendiente** — ver **Fase G** en [`01-core-domain-reorganization.md`](./01-core-domain-reorganization.md).
