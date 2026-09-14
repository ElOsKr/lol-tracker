# Investigación: selección de colas de LoL y nueva identidad

Fecha: 2026-09-13. Base revisada: commit 04ce96c, oficial v1.11.0 integrada, rama codex/lol-all-queues. Estado: investigación y propuesta; sin implementación de nuevas colas.

Actualización posterior 2026-09-13: Oscar eligió **Riftally** y pidió empezar únicamente por ARAM normal. Esa primera implementación local se documenta en DEVELOPMENT.md; las propuestas restantes de este documento siguen pendientes. El renombrado de la aplicación se hará en otra entrega.

## Requisitos confirmados

- Poder consultar cualquier cola de LoL, eligiendo una concreta; no mostrar todas por defecto.
- Conservar el widget de escritorio, OBS, historial, ajustes y copias de seguridad.
- Sustituir League Companion: Oscar lo descarta porque ya existe. Solicita propuestas cortas y originales; nombre definitivo pendiente.
- TFT sigue siendo una fase posterior con modelo propio. Arena pertenece al alcance LoL, aunque exige un adaptador específico.

## Propuesta de experiencia

Un selector visible y común a la aplicación: **Cola: ARAM Caos / ARAM / Solo-Dúo / Flexible / Normal…**. La selección se mantiene al navegar y reiniciar, independientemente de la opción general de recordar filtros.

En una instalación nueva se pide elegir una cola antes de consultar estadísticas. En una existente se conserva una selección concreta válida; si no existe, se pide elegir. Nunca interpretar una selección ausente como “todas”. Si la cola elegida no tiene partidas, mostrar un estado vacío con esa cola y la posibilidad de importar historial. No cambiarla automáticamente por otra ni mezclar resultados.

Aplicar la selección a historial, tarjetas de resumen, sesiones, campeones, estadísticas, tendencias, récords, compañeros y sus detalles. Los filtros locales de parche/campeón se ajustan al cambiar de cola, sin borrar la elección global. Ignorar respuestas de peticiones antiguas si el usuario cambia rápidamente de cola.

Propuesta para Widget / OBS: conservar su selección concreta existente; ofrecer explícitamente “Seguir la cola de la app” o fijar otra cola. Migrar el antiguo valor nulo a seguimiento, nunca a suma de colas. Si la app aún no tiene selección, mostrar “Elige una cola”. Mantener altura, opacidad, cuenta y dirección OBS. Mostrar el nombre de cola en el widget para que el alcance del porcentaje sea evidente.

Propuesta para partida en directo: si la partida real pertenece a otra cola, indicar la diferencia y ofrecer cambiar a ella. No cambiar la selección sin intervención. El resumen posterior y los historiales de jugadores deben usar la cola de la partida que se está consultando; no sumar la carrera de otras colas.

No incluir “Todas” en la primera implementación. Es una propuesta más estricta que el requisito de no usarla por defecto; podría añadirse posteriormente como comparación explícita.

## Fuentes y cobertura

Riot publica identificadores de colas, incluyendo Solo/Dúo 420, Flexible 440, ARAM 450, Swiftplay 480, Quickplay 490, personalizadas 0 y Arena 1700. El catálogo también contiene modos retirados y TFT: no equivale a una lista de colas actualmente jugables. [Catálogo oficial](https://static.developer.riotgames.com/docs/lol/queues.json).

La League Client API es local y Riot no la soporta oficialmente para terceros. La Live Client Data API permite consultar la partida activa; no sustituye una fuente de historial. [Documentación Riot](https://developer.riotgames.com/docs/lol#league-client-api).

Mantener LCU y el flujo SGP existente evita introducir ahora una API key y un servidor nuevos. Es una decisión técnica propuesta, no una garantía de disponibilidad de esos servicios. La versión upstream limita y sondea la ventana histórica de 1000 partidas: es comportamiento del código revisado, no un compromiso contractual de Riot ni 1000 partidas por cada cola. Ver src/main/lcu.ts, fetchAllMatchIds e isHistoryWindowFull.

Se intentó consultar el catálogo local mediante league-connect: devolvió ClientNotFoundError. No se verificaron en vivo endpoints, colas habilitadas ni payloads de otras colas en esta sesión. Antes de implementar adaptadores especiales hay que repetir la consulta con el cliente disponible y revisar muestras sin guardar credenciales ni identidades en Git.

Catálogo propuesto: identificador estable, etiqueta, familia, producto, disponibilidad y capacidades. Combinar la tabla oficial con los datos que devuelva el cliente y las colas ya almacenadas; permitir “Cola 1234” como etiqueta provisional. No clasificar por rangos numéricos. Distinguir cola conocida, cola disponible para jugar y cola con historial. Una cola desconocida requiere validar producto y estructura antes de importarla como LoL.

## Hallazgos del repositorio y cambios necesarios

| Área                   | Evidencia actual                                                                                                      | Cambio propuesto                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Catálogo               | src/shared/queues.ts solo etiqueta 2400 y 2450                                                                        | Catálogo ampliable y capacidades por modo                                                         |
| Captura                | src/main/lcu.ts filtra MAYHEM_QUEUE_IDS en importación, refresco y fin de partida; SGP_MAYHEM_TAGS filtra el servidor | Sustituir todos los puntos por una política común de admisión LoL y solicitudes por cola          |
| Historial descartado   | getKnownGameIds suma games e ignored_games; otras colas se guardan como ignoradas                                     | Versionar decisiones de descarte y reexaminar los IDs antiguos sin tocar las partidas conservadas |
| Importación completada | backfill_complete se guarda por cuenta                                                                                | Estado por cuenta, cola y versión de política; no heredar “completado” de Mayhem                  |
| SQL                    | applyQueueFilter sin queue suma las colas no ocultas                                                                  | Para consultas de pantalla exigir cola resuelta; catálogo global en consultas separadas           |
| Selector               | QueueSelect oculta el control con menos de dos colas y borra selección sin resultados                                 | Mostrar selector estable y estados vacíos; eliminar retorno automático a todas                    |
| Persistencia           | useViewState recuerda por página solo si remember_filters está activo                                                 | Preferencia global propia y contrato IPC validado                                                 |
| Compañeros y directo   | Hay consultas sin parámetro de cola; LiveGame mantiene un filtro Mayhem                                               | Propagar cola a consultas, cachés, enlaces de detalle y resumen                                   |
| Widget                 | queue nula equivale a todas; selección independiente en SQLite                                                        | Seguimiento explícito o cola fija; nunca agregado implícito                                       |
| Métricas               | opScore.ts declara calibración ARAM Mayhem; detectRemake usa duración menor de 300/600 segundos                       | Política por modo; no extrapolar puntuación ni remake a todos                                     |
| Equipos                | LiveScoreboard fija 100/200; modelo no guarda posición final ni subequipos                                            | Adaptador Arena con posición y equipos reales, sin convertir ausencia de resultado en derrota     |

### Capturar y ver son operaciones diferentes

Propuesta: conservar las partidas LoL compatibles que se detecten aunque el usuario esté viendo otra cola; consultar siempre solo la seleccionada. Así cambiar la vista no pierde partidas ni requiere jugar con el selector correcto. La importación histórica se solicita por la cola elegida, con progreso, cancelación y reintentos por cuenta/cola. Evitar lanzar varias importaciones superpuestas al cambiar de vista.

No borrar ignored_games indiscriminadamente: la tabla actual no conserva el motivo ni la cola del descarte. Una migración puede conservarla como registro legado pero dejar de usarla para excluir definitivamente partidas bajo la política nueva. Los descartes futuros deben distinguir producto incompatible, formato pendiente y fallo temporal; los fallos temporales se reintentan.

### Modelo y estadísticas

El esquema ya contiene queue_id e índices, así que no hace falta una base por cola. Separar contexto de vista y almacenamiento. Auditar también importación/exportación JSON y reparación, porque regeneran estadísticas y podrían volver a aplicar las reglas antiguas.

Comprobación adicional: importData llama directamente a insertGameFull, sin pasar por el filtro LCU. La política de validación debe estar también en la frontera de inserción, con resultado explícito para formatos incompatibles. writeExportTo exporta el archivo completo: conservar ese comportamiento para backups, identificándolo como copia completa; una eventual exportación de la vista sería otra acción, filtrada de forma explícita.

useIpc ya descarta respuestas antiguas con un contador de petición. useMatches no lo hace: una carga de la cola anterior podría completar después de la nueva y reemplazar o añadir partidas incorrectas. Añadir una generación de consulta y reiniciar la paginación al cambiar cola/cuenta; probar una respuesta lenta seguida de otra rápida y un “cargar más” que termine tras cambiar el filtro.

Para LoL de dos equipos, empezar por resultado, KDA, daño, oro, duración y objetos. Añadir CS, visión y rol cuando el payload los contenga, representando ausencia como dato no disponible. Conservar score de Mayhem; para otras familias mantenerlo nulo hasta tener una fórmula validada. Los campos de aumentos y sus páginas solo se muestran en modos compatibles.

Arena necesita posición final, subequipos y reglas de resultado confirmadas en muestras. No basta con reutilizar win y los equipos 100/200. Personalizadas, entrenamiento, bots y modos rotatorios deben someterse a una matriz de cobertura: si la fuente no expone una partida, mostrar esa limitación sin prometer recuperación completa. La cola 0 es válida y no se debe perder mediante comprobaciones de valor falsy.

## Orden de implementación y aceptación

1. Catálogo y contexto global persistente de cola; migración de selecciones. Prueba: abrir, navegar, reiniciar y consultar una cola vacía sin mezclar resultados.
2. Propagación del contexto a SQL, IPC, vistas, compañeros, directo y widget. Prueba: datos de dos colas y dos cuentas; ninguna cifra, sesión o racha cruza el filtro; cambios rápidos no muestran respuestas antiguas.
3. Captura e importación LoL de dos equipos; reevaluación de descartes y estado por cola. Prueba: partida anteriormente ignorada recuperable, ausencia de duplicados, cancelación, reconexión y límite histórico comunicado.
4. Métricas por capacidad y adaptadores especiales, incluyendo Arena. Prueba: payloads saneados de cada familia, valores ausentes, remakes y posiciones; excluir TFT expresamente.
5. Renombrado con el nombre elegido y migración de almacenamiento; comprobar empaquetado y arranque.

En cada entrega: typecheck, lint, formato localizado, build y pruebas de regresión relevantes. Mantener test:widget. Antes de migraciones, backup consistente SQLite; validar sobre copia y comparar registros/ajustes. La aceptación final requiere partidas reales representativas y validación visual en Electron y OBS. “Todas las colas” no estará completado hasta resolver también las familias especiales o documentar la falta de datos de origen.

## Nombre y migración de identidad

Opciones creativas: **Riftally** (Rift + tally, registro/recuento), **Riftfolio** (archivo personal de partidas) y **Riftuno** (corto y fácil de pronunciar en español). Preferencia de esta propuesta: Riftally. Son candidatos, no nombres aprobados. En las búsquedas web exactas de esta sesión no apareció una app claramente homónima para Riftally/Riftfolio; Riftuno devolvió coincidencias textuales ajenas a una app. Esto no confirma disponibilidad de marca, dominio ni identificador de tienda. La elección debe preceder a la comprobación final del candidato.

Cambiar el título visual no completa el renombrado. Revisar package.json y lockfile, productName, appId, artifactName, cabecera, bandeja, widget, textos, accesos directos, AppUserModelId y arranque automático. Mantener licencia MIT y atribución a Mayhem Tracker.

src/main/paths.ts usa userData en producción. Al cambiar la identidad puede cambiar esa ruta: copiar de forma controlada la base antigua y sus backups a una ubicación propia, validar integridad y conservar el origen. No sobrescribir una base nueva existente. En desarrollo, mantener inicialmente data/ y la carpeta del checkout. Conservar la URL local de OBS. Mantener desactivado el actualizador oficial y separar la versión de nuestra app de la referencia upstream integrada.

El renombrado del repositorio/carpeta no es necesario para el primer cambio visual y exige actualizar rutas y accesos directos; no hacerlo por rutina.

## Mantener la integración con upstream

Concentrar lo nuevo en módulos pequeños: catálogo de colas, políticas de normalización/estadísticas por modo y contexto global de selección. Reutilizar el SQL y la infraestructura existentes con parámetros explícitos. Mantener separados los adaptadores de modos especiales y los cambios de identidad para facilitar las siguientes revisiones oficiales. No desarrollar un segundo capturador para el widget.

La automatización existente seguirá detectando upstream; los merges continuarán siendo revisados. En cada actualización, prestar especial atención a src/main/lcu.ts, db.ts, api.ts, LiveGame y al actualizador, porque son superficies compartidas. Las pruebas de separación de colas deben quedar como regresiones permanentes junto a las del widget.
