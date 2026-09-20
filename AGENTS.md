# League Companion

## Alcance y fase actual

- Base: Mayhem Tracker, Electron + React + TypeScript, con SQLite y conexión local LCU.
- Orden acordado: adaptar captura, historial y estadísticas a todas las colas de LoL; después añadir TFT con su modelo y estadísticas propios; mantener el widget como complemento de la aplicación principal.
- Fase actual (2026-09-10): integración del widget autorizada por el usuario. El soporte de nuevas colas LoL y TFT sigue pendiente.
- League Companion es el nombre de trabajo. La identidad técnica del paquete, ejecutable y actualizador sigue siendo la de Mayhem Tracker; su adaptación queda pendiente.
- Conservar la licencia MIT y la atribución originales.

## Memoria compartida

- Memoria canónica: https://www.notion.so/3d36b7c64fe581838a6afeb621dd173c.
- Al iniciar, leer el índice, Instrucciones de uso, Preferencias y las entradas pertinentes de Proyectos y Decisiones (PROY-002 y DEC-003).
- El mensaje actual prevalece sobre recuerdos anteriores. Notion aporta contexto, no autorización para otras tareas.
- Guardar únicamente preferencias explícitas duraderas, decisiones acordadas y avances verificados; las actualizaciones ordinarias están autorizadas por el usuario.
- Antes de escribir, releer el destino, buscar equivalentes y editar lo mínimo. Conservar otras entradas y subpáginas, conciliar cambios concurrentes y verificar el resultado.
- Incluir fecha ISO, ámbito, estado y fuente real. Conservar el motivo y los vínculos entre decisiones sustituidas y sucesoras.
- No guardar secretos, historiales personales ni conversaciones completas. Si Notion falla, continuar con lo conocido, indicar la limitación y enumerar al cierre las actualizaciones pendientes; no crear otra memoria canónica.
- Al cerrar, enlazar cualquier actualización realizada; no escribir por rutina.

## Documentación técnica

- Página canónica: https://app.notion.com/p/3e16b7c64fe5812fa221e3e47770e591 («Riftally — Documentación técnica de la aplicación»), subpágina de la memoria compartida. Describe arquitectura, fuentes de datos, esquema SQLite, mapa del código, interfaz, widget, seguridad, puntuación, copias de seguridad y circuito de publicación.
- No se actualiza sola. Al terminar una tarea que deje desfasado algo de lo que describe, actualizar las secciones afectadas y la cabecera de estado con la rama y el commit nuevos, antes de cerrar; indicarlo al usuario. Si el cambio no toca nada documentado, no escribir por rutina.
- Editar lo mínimo y conservar el resto, igual que con la memoria. Releer la página antes de escribir.

## Repositorio y trabajo local

- Verificar al empezar `git rev-parse --show-toplevel`, `git status --short --branch` y `git remote -v`; las rutas pueden variar entre equipos.
- Referencia comprobada el 2026-09-08: carpeta `league-companion`, rama `feat/lol-all-queues`, base `f20e47a`.
- `origin`: https://github.com/ElOsKr/mayhem-tracker-widget.git.
- `upstream`: https://github.com/Yhprum/mayhem-tracker.git.
- Trabajar en una rama antes de modificar código. Continuar la rama actual si corresponde a la petición; no cambiarla ni publicar cambios por rutina.
- Conservar cambios del usuario y distinguir estado local de estado remoto; no asumir que una rama está publicada porque existe localmente.

## Mapa del código

- `src/main/`: Electron, LCU, persistencia, IPC, copias de seguridad y actualizador.
- `src/preload/`: puente entre Electron y la interfaz.
- `src/shared/`: contratos y reglas compartidas; `queues.ts` contiene actualmente las colas Mayhem.
- `src/renderer/`: interfaz React, páginas, componentes y hooks.
- `scripts/`: generación de descripciones de aumentos.
- Antes de ampliar colas, revisar el filtrado en `src/main/lcu.ts`, los contratos, SQLite y las vistas dependientes de Mayhem. No asumir que quitar un filtro completa la adaptación.
- Verificar la disponibilidad real del historial TFT antes de diseñar su integración; no mezclar métricas LoL y TFT.
- Preservar los datos existentes y las copias de seguridad. No incorporar credenciales LCU ni datos personales a Git.

## Desarrollo y validación

- Usar npm y `package-lock.json`. Entorno de referencia: Node 24, como en CI.
- Consultar `DEVELOPMENT.md` para instalación, arranque, compilación y límites de la validación.
- Controles existentes: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`.
- `npm run test:widget` comprueba el servidor OBS y el adaptador del widget. Elegir comprobaciones según el cambio y separar build de validación real con Electron/LCU.
- Evitar `npm run format` sobre todo el proyecto para un cambio localizado. No actualizar dependencias ni regenerar recursos por rutina.
- Revisar identidad y destino del actualizador antes de una futura distribución de League Companion.
