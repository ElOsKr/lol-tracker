# AVG Score por cola

Actualización 2026-09-15: ARAM normal (450) ya usa un perfil experimental v2, con transferencias pequeñas de peso a participación para tanques, soportes y tiradores, contrastadas con las partidas antiguas autorizadas por Oscar. Véase CALIBRATION-ARAM.md. Sustituye la primera entrega que reutilizaba todos los pesos Mayhem v4. El análisis siguiente describe la fórmula Mayhem y conserva las propuestas de ampliación pendientes; las demás colas aún no reciben puntuación nueva.

Fecha: 2026-09-15. Revisión del código local de Riftally, basado en Mayhem Tracker v1.11.1. Estado: investigación; no se han activado puntuaciones para otras colas ni cambiado la fórmula Mayhem.

## Qué calcula actualmente

La fórmula propia está en `src/shared/opScore.ts`, versión 4. Se comparte entre el proceso principal y el desglose del marcador. No consulta una nota de Riot ni un servicio de OP.GG.

Cada componente aporta `peso × min(1, max(0, valor / referencia))^1.3`. Las referencias son KDA 8, participación en bajas 90 % y, para daño a campeones, daño recibido, curación y oro, el máximo de todos los participantes de esa partida. KDA divide bajas más asistencias entre al menos una muerte; participación divide bajas más asistencias entre las bajas del equipo.

| Clase       | KDA | Participación | Daño | Recibido | Curación | Oro |
| ----------- | --- | ------------- | ---- | -------- | -------- | --- |
| Por defecto | 2.2 | 2.2           | 2.6  | 1.1      | 0.6      | 1.1 |
| Asesino     | 2.6 | 2.4           | 2.8  | 0.5      | 0.2      | 1.3 |
| Tirador     | 2.2 | 2.2           | 2.8  | 0.7      | 0.5      | 1.4 |
| Mago        | 2.2 | 2.3           | 2.8  | 0.7      | 0.4      | 1.4 |
| Luchador    | 2.2 | 2.2           | 2.4  | 1.4      | 0.5      | 1.1 |
| Tanque      | 2.0 | 2.5           | 2.1  | 2.2      | 0.3      | 0.7 |
| Soporte     | 2.2 | 2.7           | 1.7  | 0.8      | 1.8      | 0.6 |

Se añade solo la bonificación del multikill más alto: doble 0.15, triple 0.30, cuádruple 0.45 o pentakill 0.60; no se multiplica por cuántos hubo. Ganar añade 0.60. El líder de daño gana hasta otros 0.60 según su ventaja sobre el segundo: empieza a aportar al superar el 20 % y llega al máximo con el 70 %.

La suma se multiplica por 1.04, se redondea a una décima y se limita a 1–10. El valor sin limitar decide el MVP de cada equipo ganador y el ACE de cada equipo perdedor. Los aumentos no son una entrada de la fórmula; sí afectan indirectamente a las estadísticas del jugador.

`getDashboardStats` en `src/main/db.ts` usa `AVG(ps.score)`: media aritmética de las notas guardadas, con los filtros de cuenta, cola, campeón y parche. Excluye remakes y SQLite omite notas nulas. No pondera por duración y no depende solo de la página visible del historial. Los comentarios de la fórmula describen una calibración con partidas Mayhem; no se ha reproducido esa calibración en esta revisión.

## Qué se puede reutilizar y qué falta

Se pueden reutilizar el cálculo compartido, los desgloses, la persistencia, los promedios y la presentación. Quitar los filtros `MAYHEM_QUEUE_IDS` activaría un cálculo, pero no demostraría que mida adecuadamente otro modo.

| Familia                                   | Propuesta pendiente de implementar                                                                                                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ARAM normal y Clash ARAM                  | Primer candidato. Usar los seis componentes como base y comprobar distribución y sesgos por clase con partidas de estas colas antes de fijar pesos.                                                                  |
| Grieta: normales, clasificatorias y Clash | Perfil propio por rol real, con evaluación de CS/min, visión, objetivos y aportación al equipo. La clase del campeón no equivale a su posición; debe existir un comportamiento explícito cuando el rol no se conoce. |
| URF y otros rotatorios                    | Perfiles por reglas del modo; comprobar ritmos de oro, daño y muertes antes de reutilizar umbrales.                                                                                                                  |
| Arena                                     | Perfil por subequipo y puesto final, con reglas propias de insignias. Requiere muestras reales; repartir MVP/ACE a todos los subequipos con la regla actual no es una adaptación suficiente.                         |
| Bots, práctica y cooperativos             | Mantener sin nota hasta definir un objetivo de evaluación y validar los datos. No comparar sus notas con las competitivas.                                                                                           |

Límites de la fórmula actual: compara contra máximos de la misma partida, no contra jugadores del mismo campeón/rol; recompensa daño recibido sin saber si fue útil; usa curación total sin separar autocuración ni escudos; no incorpora visión, súbditos, objetivos, control de masas, duración ni rol. La bonificación por victoria mezcla rendimiento individual y resultado. Son decisiones del modelo, no errores aritméticos.

## Ruta de implementación propuesta

1. Separar capacidad de puntuación de capacidad de aumentos: resolver un perfil por cola/modo, con versión propia, y conservar Mayhem v4 sin alterar sus resultados.
2. Pasar el mismo contexto a captura, reparación, recálculo histórico, amigos y marcador. Actualmente hay restricciones Mayhem en todos esos caminos; cambiar solo la vista produciría notas incoherentes.
3. Ampliar los datos de entrada según el perfil. Ya se guardan CS, visión y posición cuando existen en `match_mode_stats`; verificar cobertura real del rol y capturar objetivos antes de usarlos. Datos ausentes no equivalen a cero. Personalizadas necesitan resolver también mapa/modo, porque comparten cola 0.
4. Versionar el recálculo histórico e identificar qué perfil/version produjo cada nota. Recalcular sobre copia primero; evitar mezclar notas antiguas y nuevas en el mismo promedio.
5. Validar determinismo, datos incompletos, remakes, equipos, empates, límites, insignias y coincidencia entre nota persistida y desglose. Confirmar que Mayhem mantiene sus resultados. Para calibrar, revisar distribución y casos concretos por cola y clase/rol, sin imponer porcentajes de notas altos solo por estética.

Siguiente entrega recomendada: perfil experimental de ARAM normal, reutilizando la infraestructura y mostrando claramente que es una estimación propia. La activación de nuevas notas queda pendiente de implementación y validación.
