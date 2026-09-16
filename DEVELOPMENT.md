# Desarrollo de Riftally

Riftally es el nombre elegido. La interfaz y la identidad del ejecutable siguen siendo Mayhem Tracker hasta la entrega específica de renombrado.

## Puntuación ARAM normal — 2026-09-15

La cola 450 admite AVG Score experimental con perfil propio v2: tanques y soportes trasladan 0.3 de peso de daño a participación; tiradores trasladan 0.1 de daño y 0.1 de oro a participación. Los demás pesos, curvas y bonificaciones permanecen iguales. Esta revisión conservadora se contrastó con el historial disponible, autorizado por Oscar pese a su antigüedad; no constituye validación frente a notas oficiales. No incorpora todavía escudos ni control de masas. `hasScore` separa puntuación y aumentos; la cola se pasa explícitamente a captura, reparación, amigos y marcador. Remakes sin nota. La política `mayhem-v4-aram-experimental-v2` provoca recálculo tras cargar campeones al arrancar. Mayhem v4 conserva sus resultados; Clash ARAM y otras colas siguen sin nota. Pruebas SQLite: captura, media, migración desde v1, reparación, persistencia y coincidencia del desglose. Recálculo sobre copia consistente: conservación del resto de tablas/ajustes y comparación exacta de resultados Mayhem con la fórmula anterior. Metodología en CALIBRATION-ARAM.md. Reiniciar desde Quit para cargar el cambio.

## Integración oficial v1.11.1 — 2026-09-14

Integrada v1.11.1 (91cb554): revisión completa del historial disponible una vez por cuenta y arranque, importación manual completa y recuperación si las últimas 20 partidas no contienen ninguna conocida. Conserva las tres colas admitidas y los descartes por política aram-v1; la nueva consulta isGameKnown respeta esa política para recuperar ARAM normal descartado por versiones antiguas. Sin cambios de esquema ni dependencias. La cobertura sigue limitada por el historial que Riot ofrece.

## Otras colas LoL — 2026-09-14

Catálogo de colas obtenido de Riot y del cliente local: clasificatorias, normales, ARAM, Clash, bots, rotatorios, Arena, cooperativos, práctica, personalizadas e históricas. TFT excluido por catálogo y validación del payload. El selector agrupa las colas y conserva una sola selección, incluida la cola 0. Una entrada no implica que Riot la tenga disponible actualmente ni que publique todo su historial.

La política lol-v1 reexamina descartes anteriores y recorre el historial sin limitarlo a etiquetas ARAM. Captura solo partidas LoL reconocidas con participantes y resultado explícito; una respuesta incompleta no se convierte en derrota. Muestras reales de diez colas importadas sobre copia SQLite, conservando tablas/ajustes e integridad. Backup consistente previo: backups/lol-queues-validation/pre-queues.db. No se ha importado directamente en la base real durante las pruebas.

CS, visión y posición aparecen en detalle cuando existen. Arena usa subequipos y posición final cuando la fuente los proporciona; equipos desconocidos no se agrupan falsamente. El widget muestra puesto si está disponible. Resultado y winrate usan el resultado explícito del servicio; la puntuación e iconos de aumentos Mayhem no se extrapolan a otros modos. Remakes fuera de Mayhem requieren rendición temprana además de duración corta. En directo la Grieta no se etiqueta como Abismo y el marcador admite más de dos equipos.

Pruebas: selección incluida cola 0 y ausencia de valor, exclusión TFT, resultados incompletos, colas separadas, Arena sintético, preservación de datos, muestras reales de normales/Solo-Dúo/Flexible/Clash/URF/práctica/personalizadas/Bots Malditos; interfaz Electron con selección, persistencia, estados vacíos y puestos Arena. Arena y Enjambre aún requieren validación con partidas reales; no había muestras propias disponibles. Exportación y reparación conservan las reglas de modo. Reiniciar por Quit para cargar la versión; la importación inicial recuperará las colas disponibles dentro de la ventana del servicio. Sin ampliar TFT ni publicar cambios.

## Contadores por cola — 2026-09-14

El panel desplegable «Totales por cola comunicados por Riot», bajo el selector global, muestra snapshots de victorias y derrotas de localPlayer del recurso EOG. La captura verifica cuenta y obtiene la cola desde el detalle de la misma partida; no depende del filtro de captura ARAM. Escucha cambios, lee al conectar y reintenta durante el polling. Sin datos muestra pendiente, nunca el historial local como total histórico. Rechaza valores vacíos, inválidos, regresiones y observaciones antiguas; no incrementa manualmente ni duplica eventos.

SQLite añade queue_lifetime_totals por cuenta/cola, incluido en exportaciones JSON y copias que las utilizan; importaciones anteriores siguen admitidas. Pruebas sintéticas de persistencia, duplicados, cuentas, colas, valores inválidos y exportación/importación correctas. Vista compilada comprobada en Electron con base aislada. Pendiente validar una partida real, cobertura histórica y remakes; el esquema LCU existe pero no había resultados EOG disponibles durante la investigación. Reiniciar desde Quit y terminar una partida para capturar el primer valor. Los contadores no sustituyen las estadísticas ni el winrate del widget.

## ARAM normal — 2026-09-13

Añadida captura de ARAM normal (450) al refresco, importación histórica y fin de partida; continúan ARAM Mayhem (2400) y Mayhem Classic (2450). El selector superior muestra una sola cola y la guarda en SQLite. Sin selección previa se abre ARAM normal; una cola vacía no cambia a “todas”. Historial, estadísticas, compañeros y resumen respetan la cola. Las selecciones antiguas por página se sustituyen por la global; los valores antiguos de hidden_queues se conservan pero ya no gobiernan las vistas.

Widget / OBS mantiene su cuenta, tamaño y opacidad y permite fijar cualquiera de las tres colas, incluso sin partidas. Una selección antigua vacía se interpreta como ARAM normal. La URL de OBS sigue siendo la misma. Los aumentos y la puntuación calibrada para Mayhem no se aplican a ARAM normal; el score se deja sin valor. En ARAM normal, la detección conservadora de remake requiere el indicador de rendición temprana y menos de cinco minutos; pendiente contrastarlo con muestras reales.

La política aram-v1 reexamina el historial aunque la importación Mayhem anterior estuviera completada. Conserva los descartes antiguos y registra los nuevos por versión de política. Importa las tres colas admitidas independientemente de la vista elegida; otras colas siguen fuera de alcance. El límite histórico del servicio sigue vigente.

Validación: typecheck, lint, formato, build, test:widget y test:aram. Prueba de interfaz compilada en Electron con base aislada: selección, navegación, recarga, colas vacías y páginas principales. Copia consistente previa en backups/aram-normal-1789330102523/pre-aram.db; migración ensayada sobre otra copia con conservación exacta de tablas/ajustes existentes e integridad correcta. Las pruebas de transporte utilizan respuestas sintéticas; falta verificar una partida real y repetir OBS con esta versión. Reiniciar completamente desde Quit en la bandeja para cargar la compilación nueva.

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
