# Desarrollo de League Companion

La base sigue siendo Mayhem Tracker. El alcance acordado es ampliar primero a todas las colas de LoL, después añadir TFT y mantener el widget como complemento. Esta preparación no implementa esas funcionalidades.

## Entorno

Windows, Node.js 24 (versión utilizada en CI) y npm. En esta sesión se comprobaron Node 24.20.0 y npm 11.19.0. Ejecutar los comandos desde la raíz del repositorio.

```powershell
Set-Location 'C:\Users\oscar\Documents\Codex\2026-09-06\pu\outputs\league-companion'
git rev-parse --show-toplevel
git status --short --branch
git remote -v
```

En otro ordenador, ajustar únicamente la ruta al checkout correspondiente. Referencia inicial del 2026-09-08, antes de publicar: rama `feat/lol-all-queues`, sin seguimiento remoto configurado; commit base `f20e47a`. Los remotos son `origin` (ElOsKr/mayhem-tracker-widget) y `upstream` (Yhprum/mayhem-tracker). Consultar `git status --short --branch` y `git branch -vv` para comprobar el seguimiento actual.

## Instalación y arranque

Para una instalación limpia con las versiones del lockfile:

```powershell
npm ci
npm run rebuild
npm run dev
```

`npm ci` reinstala las dependencias. `rebuild` prepara módulos nativos, incluido better-sqlite3, para Electron; repetirlo tras cambios de Electron o problemas de ABI. `dev` inicia la aplicación con electron-vite. Se necesita el cliente de League of Legends para comprobar la conexión LCU y el historial real.

En desarrollo, los datos se guardan en `data/` y las copias en `backups/`, ambos excluidos de Git. En producción se utiliza el directorio userData de Electron. Conservar los datos al cambiar de entorno.

## Comandos disponibles

| Comando                                      | Uso                                                           |
| -------------------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                                | Arrancar Electron en desarrollo.                              |
| `npm run typecheck`                          | Comprobar TypeScript en main/preload y renderer.              |
| `npm run lint`                               | Analizar con oxlint.                                          |
| `npm run format:check`                       | Comprobar formato sin modificar archivos.                     |
| `npm run format -- AGENTS.md DEVELOPMENT.md` | Formatear únicamente los documentos indicados.                |
| `npm run build`                              | Compilar main, preload y renderer en out/.                    |
| `npm run preview`                            | Abrir la aplicación compilada; ejecutar build antes.          |
| `npm run rebuild`                            | Preparar las dependencias nativas para Electron.              |
| `npm run dist`                               | Compilar y empaquetar el portable Windows en dist/.           |
| `npm run gen:augments`                       | Regenerar descripciones de aumentos; solo cuando corresponda. |

`dist` mantiene todavía el nombre MayhemTracker.exe y la identidad original. La consulta y la instalación de actualizaciones oficiales están desactivadas para evitar sustituir las funciones propias por el ejecutable original. Queda pendiente adaptar la identidad y disponer de un canal de actualizaciones propio. `npm version` ejecuta preversion y puede crear un commit y una etiqueta: no usarlo como comando de validación.

## Integración oficial — 2026-09-13

Integrada la versión oficial v1.11.0 (58468b4) en la rama codex/lol-all-queues sobre nuestra base a9eca2c. Incluye partida en directo, resumen posterior, corrección de totales de sesión, mejoras de importación y aumentos del parche 26.18. Conserva Widget / OBS, ventana de escritorio, altura/opacidad y preferencias. Las dependencias no cambian; package-lock.json solo actualiza la versión del proyecto.

Typecheck, lint, formato, build y cuatro pruebas automatizadas correctos. Se creó una copia consistente mediante la API de backup de SQLite en backups/upstream-1.11.0-validation/pre-update.db. Sobre otra copia aislada se verificaron integridad, conservación exacta de las tablas y ajustes existentes, totales de sesiones, resumen posterior y consulta del widget con la base nueva. Esta validación no sustituye una prueba gráfica de Electron, una partida en directo ni una nueva comprobación en OBS. Las copias y el script local de comprobación están excluidos de Git. El soporte de todas las colas LoL sigue pendiente.

## Validación de referencia — 2026-09-08

- `npm run typecheck`: correcto.
- `npm run lint`: correcto.
- `npm run format:check`: correcto, incluidos estos documentos.
- `npm run build`: correcto fuera del entorno restringido. Dentro de este, esbuild falló con acceso denegado al resolver la configuración desde un directorio superior; no fue un error del código.
- Instalación limpia, rebuild nativo, arranque gráfico, empaquetado y conexión con LoL real: no ejecutados en esta tarea.
- No existe un script test en package.json.

Los scripts existentes se conservan sin cambios. Para futuros cambios de código, ejecutar typecheck, lint, format:check y build; añadir validación funcional específica cuando se implemente el alcance.

## Widget integrado

En la aplicación, abre **Widget / OBS**. Elige una cuenta y una cola del historial almacenado. **Abrir widget** crea una ventana transparente de 360 × 560, siempre encima; arrastra su cabecera para moverla. Cerrar esa ventana no cierra la aplicación. También se abre desde el menú de la bandeja.

La ventana usa IPC de Electron y la misma base SQLite y capturador que la aplicación. No inicia el servidor del widget antiguo ni importa automáticamente su JSON: ese proyecto y sus datos se conservan por separado. El alcance de captura actual sigue siendo ARAM Caos.

**Activar fuente OBS** inicia un servidor exclusivamente en 127.0.0.1:4123. Pega la URL mostrada en una fuente Navegador de OBS (360 × 560). No hace falta configurar el router. Si el puerto está ocupado, cierra el widget antiguo antes de reintentar. **Detener fuente OBS** o salir de la aplicación cierra el servidor. Ocultar la ventana principal en la bandeja mantiene el widget y OBS funcionando. La fuente OBS se activa manualmente en cada arranque.

El porcentaje refleja las partidas almacenadas de la selección, sin remakes. La racha se calcula sobre hasta 100 partidas recientes; si puede continuar más atrás se indica con puntos suspensivos. El widget muestra 15 partidas y refresca la instantánea cada cinco segundos. Al desconectar LoL conserva los datos disponibles. Los iconos se cargan en segundo plano por parche.

Validación automatizada: npm run test:widget. Incluye servidor local, rutas permitidas, Host/Origin, puerto ocupado, cierre, filtros y estadísticas. Los scripts predev/prebuild/predist compilan la interfaz del widget; los archivos generados public-widget/build están excluidos de Git.

Validación de integración (2026-09-11): typecheck, lint, format:check, build y tres pruebas del widget correctos. Rebuild nativo y arranque Electron comprobados; conexión LCU e historial real disponibles. Probados apertura, cierre y reapertura del widget y activación/desactivación HTTP de OBS. El cierre oculta y reutiliza la ventana: destruirla durante las pruebas de interfaz provocó un fallo nativo de Electron en Windows. La prueba dentro de OBS y el empaquetado portable quedan pendientes. La integración se desarrolla en feat/widget-integration. La altura (280–560 px) y la opacidad (30–100 %) del escritorio se guardan automáticamente; ancho fijo de 360 px. Estos últimos controles tienen validación automatizada, con comprobación visual pendiente. Para cargar cambios del proceso principal, usar Quit en la bandeja y volver a abrir la app; la X solo la oculta.
