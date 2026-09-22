# Perfil experimental ARAM normal v2

Fecha: 2026-09-15. Alcance: solo cola 450. Autorización: Oscar pide usar las partidas disponibles aunque pertenezcan a parches antiguos. Sustituye la reutilización directa de Mayhem v4 en ARAM normal v1; la fórmula de Mayhem permanece intacta.

## Cambio

| Clase   | Componente                 | Antes           | Ahora           |
| ------- | -------------------------- | --------------- | --------------- |
| Tanque  | Participación / daño       | 2.5 / 2.1       | 2.8 / 1.8       |
| Soporte | Participación / daño       | 2.7 / 1.7       | 3.0 / 1.4       |
| Tirador | Participación / daño / oro | 2.2 / 2.8 / 1.4 | 2.4 / 2.7 / 1.3 |

El peso total sigue siendo 9.8. No cambian KDA, daño recibido, curación, bonificaciones, límites ni redondeo. Asesinos, magos, luchadores y campeones sin clase conocida conservan sus componentes. Sus insignias pueden cambiar porque se decide el mejor jugador de cada equipo después de puntuar a todos.

## Método y límites

Se excluyeron remakes y se exigieron diez participantes por partida. División cronológica por partidas completas: 75 % para comparar dos candidatos predefinidos y 25 % para comprobar el candidato elegido. Se eligió la transferencia menor, buscando reducir dependencia de estadísticas de daño/oro sin modificar fuertemente notas individuales. No se ajustaron pesos para alcanzar un porcentaje de notas altas, igualar medias por clase ni maximizar victorias.

Los candidatos son decisiones heurísticas; no se aprendieron de etiquetas de rendimiento. La comparación previa ya había examinado agregados de toda la muestra: el último 25 % sirve como comprobación de estabilidad, no como evaluación ciega independiente. Las observaciones de una partida están relacionadas y pueden repetirse jugadores. La primera clase actual de Data Dragon no describe necesariamente la función o la build histórica. Estas limitaciones impiden afirmar una mejora objetiva de precisión o extrapolar al parche actual.

El cambio de nota sin redondear queda acotado por construcción a 0.312 para tanques/soportes y 0.208 para tiradores. En las muestras de desarrollo y comprobación, el cambio máximo de nota visible fue 0.3; este máximo observado no es una garantía para cualquier partida futura. El ajuste no resuelve todavía la ausencia de escudos, control de masas ni curación separada a aliados.

Los datos, resultados detallados y scripts con acceso al historial se conservan localmente en out y backups, excluidos de Git. No se importaron datos personales ni se modificó la base real durante la evaluación. La app recalculará al reiniciar mediante la política mayhem-v4-aram-experimental-v2.

## Verificación

Pruebas automatizadas: perfil por cola, nota persistida igual al desglose y a la vista de amigos, recálculo desde v1, remakes, reparación, persistencia, límites, suma de componentes y aislamiento de clases/colas. Sobre copia SQLite se compararon los resultados Mayhem contra una copia de la fórmula anterior, incluyendo nota sin redondear e insignias; resto de datos y ajustes conservados, integridad correcta.
