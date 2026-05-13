# Bibliotecas JS a Investigar para GhostPrompt

- @vscode/webview-ui-toolkit
Utilidad: componentes UI oficiales, accesibles y estilizados para webviews en VS Code.
Por qué es buena: si quieres mejorar el webview de GhostPrompt sin escribir CSS/JS de controles desde cero.
Integración: instalar y usar los componentes en src/ui/webview/*, empaquetar como parte del bundle.

> Estado: no investigada aún, pero prometedora para mejorar la UI sin mucho esfuerzo.

- nanoid
Utilidad: generación de IDs únicos cortos y seguros.
Por qué es buena: útil en webview para key, id, tracking de requets/streams, sin depender de Math.random.
Integración: muy ligera, solo npm install nanoid.

> Estado: no investigada aún, pero prometedora para generar IDs únicos de manera segura.

- comlink
Utilidad: comunicación más estructurada y segura entre host y webview si se desea RPC-like.
Por qué es buena: si el flujo de mensajes entre webview y extensión crece, evita tener que normalizar manualmente postMessage y onmessage.
Integración: puede usarse solo en webview si migras a un patrón de llamadas remotas.

> Estado: no investigada aún, pero prometedora para mejorar la comunicación entre host y webview si el flujo de mensajes se vuelve complejo.

- @testing-library/dom
Utilidad: pruebas de DOM más expresivas para el webview.
Por qué es buena: mejora la calidad de los tests de UI sin necesidad de un navegador completo.
Integración: útil junto a vitest para añadir tests de comportamiento del webview.

> Estado: no investigada aún, pero prometedora para mejorar la calidad de los tests de UI del webview sin necesidad de un entorno de navegador completo.

- msw (Mock Service Worker)
Utilidad: mocks de red y APIs en pruebas.
Por qué es buena: si integras flujos de red o APIs externas desde el host/webview, permite simulaciones más realistas.
Integración: se usa en pruebas, no en runtime.

> Estado: no investigada aún, pero prometedora para mejorar las pruebas de integración que involucren flujos de red o APIs externas desde el host/webview, permitiendo simulaciones más realistas sin necesidad de un entorno de red real.

- ts-pattern
Utilidad: pattern matching en TypeScript.
Por qué es buena: hace más legible el switch/if complejo sobre mensajes, estados, tipos discriminados.
Integración: aporta una capa de código más declarativa sin cambiar arquitectura.

> Estado: no investigada aún, pero prometedora para mejorar la legibilidad y mantenibilidad del código que maneja mensajes, estados y tipos discriminados.

- prettier
Utilidad: formateo consistente de código.
Por qué es buena: sistema de estilo estable, facilita revisiones y evita debates sobre formato.
Integración: como devDependency con config y pre-commit si quieres.

> Estado: no investigada aún, pero prometedora para mantener un estilo de código consistente y facilitar las revisiones sin debates sobre formato.
