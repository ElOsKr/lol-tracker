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

`dist` mantiene todavía el nombre MayhemTracker.exe y la identidad original. La adaptación de identidad y actualizador está pendiente. `npm version` ejecuta preversion y puede crear un commit y una etiqueta: no usarlo como comando de validación.

## Validación de referencia — 2026-09-08

- `npm run typecheck`: correcto.
- `npm run lint`: correcto.
- `npm run format:check`: correcto, incluidos estos documentos.
- `npm run build`: correcto fuera del entorno restringido. Dentro de este, esbuild falló con acceso denegado al resolver la configuración desde un directorio superior; no fue un error del código.
- Instalación limpia, rebuild nativo, arranque gráfico, empaquetado y conexión con LoL real: no ejecutados en esta tarea.
- No existe un script test en package.json.

Los scripts existentes se conservan sin cambios. Para futuros cambios de código, ejecutar typecheck, lint, format:check y build; añadir validación funcional específica cuando se implemente el alcance.
