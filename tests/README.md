# Carpeta `tests/`

Esta carpeta **no** es el destino principal de los tests unitarios del proyecto.

## Propósito actual

- `tests/` se reserva para pruebas de integración y otros tests de alto nivel.
- En particular, hoy se usa para:
  - `tests/integration/` → pruebas de integración / flujos completos.

## Ubicación de los tests unitarios

Los tests unitarios ahora están alojados junto al código que prueban, en el árbol `src/`.

Ejemplos de ubicación de tests unitarios collocated:

- `src/engines/.../*.test.ts` y `src/engines/.../*.test.tsx`
- `src/api/.../*.test.ts`
- `src/core/.../*.test.ts`
- `src/ui/.../*.test.ts` y `src/ui/.../*.test.tsx`

## Por qué esta separación

- Al mantener los tests unitarios collocated, es más fácil ver qué código ya está cubierto.
- La carpeta `tests/` queda libre para casos que no encajan bien como tests collocated, como pruebas de integración o herramientas específicas.

## Cómo tratar esta carpeta

- No agregues nuevos tests unitarios a `tests/`.
- Si un test es una prueba de integración o un flujo end-to-end, colócalo en `tests/integration/`.
- Si un test unitario se encuentra aquí por error, muévelo al directorio de código fuente correspondiente.
