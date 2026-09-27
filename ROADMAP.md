# Hoja de ruta de LoLeanding

Lista viva de lo que queremos hacer, ordenada en hitos. Cada hito se convierte en un _milestone_ de GitHub y cada punto en un issue cuando se empieza; aquí queda la visión completa. Tamaños orientativos: **S** una tarde, **M** varios días, **L** semanas.

Idea que guía todo: **guardar tu historial para siempre y en local, y ayudarte a entender _tus_ partidas.** Sin Overwolf, sin anuncios, sin cuenta ni servidor.

## Hito 1 — Base limpia (v0.3.0)

| #   | Qué                                                                                                                                            | Tamaño |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | **Interfaz en español.** Traducciones es/en con selector en Ajustes; idioma por defecto el del sistema. Cubre interfaz, widget y diálogos.     | M      |
| 2   | **Pestañas configurables.** Mostrar/ocultar y reordenar las entradas de la barra lateral; elegir la pestaña de inicio. Guardado en `settings`. | S–M    |
| 3   | **Notas de release limpias.** Filtrar el comentario HTML que GitHub antepone a las notas en el diálogo de actualización.                       | S      |
| 4   | **Etiquetas en las PR.** Plantilla de PR y etiquetas `enhancement` / `bug` / `documentation` para que las notas de release se agrupen bien.    | S      |
| 5   | **Limpieza del repo.** Borrar las ramas viejas ya integradas; retirar la automatización externa duplicada de novedades de upstream.            | S      |
| 6   | **Recordar tamaño y posición de la ventana.**                                                                                                  | S      |

## Hito 2 — Pulido de interfaz (v0.4.0)

| #   | Qué                                                                                                                               | Tamaño |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 7   | **Página de inicio.** Tarjetas configurables: racha actual, resumen de la última sesión, mejor campeón del mes, próximo objetivo. | M      |
| 8   | **Densidad y tamaño de texto.** Modo compacto / cómodo.                                                                           | S      |
| 9   | **Estados vacíos y de carga** coherentes en todas las páginas.                                                                    | S      |
| 10  | **Atajos de teclado.** Cambiar de pestaña (1–9), buscar (Ctrl+F), sincronizar (Ctrl+R).                                           | S      |
| 11  | **Historial virtualizado**, para que el scroll no se resienta con miles de partidas.                                              | S      |
| 12  | **Aviso al terminar la partida.** Notificación de Windows con resultado, KDA y nota cuando la app está en la bandeja.             | S      |

## Hito 3 — Catálogos (v0.5.0)

| #   | Qué                                                                                                                                                                                                                | Tamaño |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 13  | **Pestaña de objetos.** Buscador y filtros; ficha con coste, estadísticas, pasiva, de qué se compone y en qué se convierte; enlace a "tus partidas con este objeto". Datos de Community Dragon, que ya se cachean. | M      |
| 14  | **Catálogo de aumentos**, reutilizando la pestaña de estadísticas existente.                                                                                                                                       | S–M    |
| 15  | **Fichas de campeón.** Habilidades, clase y tus datos con él; enlazadas desde el historial.                                                                                                                        | M      |
| 16  | **Marcas de parche en Tendencias.** Líneas verticales por cambio de parche.                                                                                                                                        | S      |

## Hito 4 — Entender tus partidas (v0.6.0)

| #   | Qué                                                                                                                                                                                          | Tamaño |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 17  | **Ranking 1º–10º por partida.** Ya se calcula la nota de los diez; mostrar tu puesto.                                                                                                        | S      |
| 18  | **Post-partida en lenguaje llano.** Dos o tres frases automáticas con reglas sobre tus medias, sin IA externa.                                                                               | M      |
| 19  | **Etiquetas de jugador.** Para ti y para compañeros recurrentes ("racha de 4", "mejor con X", "flojo en visión esta semana"); en Live Game, etiquetas de compañeros conocidos desde tu base. | S–M    |
| 20  | **Winrate por duración y minuto de partida.**                                                                                                                                                | S      |
| 21  | **Pool de campeones.** Fiables, en prueba y "trampa".                                                                                                                                        | S      |
| 22  | **Resumen de sesión** al abrir al día siguiente.                                                                                                                                             | S      |
| 23  | **Objetivos y rachas.** Metas semanales con progreso.                                                                                                                                        | M      |
| 24  | **Exportar a CSV/JSON** el historial filtrado.                                                                                                                                               | S      |

## Hito 5 — Datos y puntuación (v0.7.0)

| #   | Qué                                                                                                                                                         | Tamaño |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 25  | **Explorador de datos.** Elegir métrica y agrupación (campeón, cola, parche, día, hora, compañero) y obtener tabla o gráfica.                               | M      |
| 26  | **Índice de habilidades.** Desglosar la nota en 5–6 ejes (agresividad, farmeo, visión, supervivencia, daño, objetivos) con tendencia por eje y por campeón. | M–L    |
| 27  | **Puntuación para Grieta y Arena.** Calibración con partidas reales; depende de 26 y de tener muestra suficiente.                                           | L      |
| 28  | **Validar Arena y Enjambre** con partidas reales.                                                                                                           | S      |

## Hito 6 — Ampliaciones

| #   | Qué                                                                                           | Tamaño |
| --- | --------------------------------------------------------------------------------------------- | ------ |
| 29  | **TFT.** Captura y estadísticas propias.                                                      | L      |
| 30  | **Widget/OBS.** Varios diseños, colores, parámetros por URL.                                  | S–M    |
| 31  | **Live Game enriquecido.** Tu winrate con y contra cada campeón de la partida, desde tu base. | M      |
| 32  | **Decidir "Queues to include"** (recomendación: no restaurarlo).                              | S      |

## Fuera de alcance

Importación de runas y builds, overlays en partida, repeticiones en vídeo y espectar a profesionales: necesitan datos globales o vídeo, y las demás aplicaciones ya lo hacen. LoLeanding se concentra en lo que ninguna hace: tus datos, en tu ordenador, para siempre.

## De dónde salen las ideas

Revisión de septiembre de 2026 de Porofessor, Blitz, Mobalytics, OP.GG for Desktop, Facecheck, iTero, Hexgate y DPM.LOL, más las peticiones de Oscar. Lo que merecía la pena se adaptó al enfoque local (por ejemplo, el índice de habilidades de Mobalytics o el explorador de datos de DPM, pero sobre tu propia base).
