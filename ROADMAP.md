# Hoja de ruta de LoLeanding

Lista viva de lo que queremos hacer, ordenada en hitos. Cada hito se convierte en un _milestone_ de GitHub y cada punto en un issue cuando se empieza; aquí queda la visión completa. Tamaños orientativos: **S** una tarde, **M** varios días, **L** semanas.

Idea que guía todo: **guardar tu historial para siempre y en local, y ayudarte a entender _tus_ partidas.** Sin Overwolf, sin anuncios, sin cuenta ni servidor.

## Hito 1 — Base limpia (v0.3.0) — completado el 2026-09-27

| #   | Qué                                                                                                                                                     | Tamaño |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | ✅ **Interfaz en español. (#13)** Traducciones es/en con selector en Ajustes; idioma por defecto el del sistema. Cubre interfaz, widget y diálogos.     | M      |
| 2   | ✅ **Pestañas configurables. (#14)** Mostrar/ocultar y reordenar las entradas de la barra lateral; elegir la pestaña de inicio. Guardado en `settings`. | S–M    |
| 3   | ✅ **Notas de release limpias. (#15)** Filtrar el comentario HTML que GitHub antepone a las notas en el diálogo de actualización.                       | S      |
| 4   | ✅ **Etiquetas en las PR. (#16)** Plantilla de PR y etiquetas `enhancement` / `bug` / `documentation` para que las notas de release se agrupen bien.    | S      |
| 5   | ✅ **Limpieza del repo. (#17)** Borrar las ramas viejas ya integradas; retirar la automatización externa duplicada de novedades de upstream.            | S      |
| 6   | ✅ **Recordar tamaño y posición de la ventana. (#18)**                                                                                                  | S      |

## Hito 2 — Pulido de interfaz (v0.5.x)

| #   | Qué                                                                                                                                                                                                                                                          | Tamaño |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 7   | ✅ **Página de inicio.** Tarjetas de racha actual, última sesión, mejor campeón del mes (últimos 30 días) y próximo objetivo, más las últimas partidas. Elegir qué tarjetas se muestran queda para más adelante.                                             | M      |
| 8   | ✅ **Tamaño de la interfaz.** Compacta, normal o grande: dibuja toda la aplicación al 85, 100 o 115 por ciento. Un solo control, porque las páginas mezclan rem con píxeles fijos.                                                                           | S      |
| 9   | ✅ **Estados vacíos y de carga** coherentes en todas las páginas, desde dos componentes compartidos.                                                                                                                                                         | S      |
| 10  | ✅ **Atajos de teclado.** Teclas 1 a 9 para las páginas del menú lateral, Ctrl+F para buscar en la página y Ctrl+R para sincronizar. Listados en Ajustes.                                                                                                    | S      |
| 11  | **Historial virtualizado.** Medido el 28-sep-2026 y aplazado: recorrer dos meses de historial de una sentada suma unos 120 MB y la página sigue respondiendo. Se retoma si algún día se nota lento.                                                          | S      |
| 12  | ✅ **Aviso al terminar la partida.** Tarjeta con resultado, KDA, nota y una línea de contexto: dentro del widget si está abierto, y si no en una ventana pequeña en la esquina. Se retira sola a los 10 s y no aparece en partida. En OBS solo si se activa. | S      |
| 12b | ✅ **Arrancar con el cliente.** Casilla para abrir la ventana cuando arranca el cliente de League, y botón que crea un acceso directo que abre League y la aplicación de una vez.                                                                            | S      |
| 13  | ✅ **Interfaz adaptable (v0.5.0).** Ventana hasta 480 × 500; barra lateral plegable a iconos; modo móvil con menú ☰; páginas que retiran columnas y reordenan tarjetas según el ancho.                                                                      | M      |

## Hito 3 — Catálogos (v0.6.x) — completado el 2026-09-29

| #   | Qué                                                                                                                                                                                                                                                                                   | Tamaño |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 13  | ✅ **Pestaña de objetos.** Buscador, filtro por categoría y orden; ficha con coste, estadísticas, pasiva, de qué se compone y en qué se convierte, y tus partidas y victorias con él. Falta el enlace al historial filtrado por objeto, que necesita un filtro nuevo en el historial. | M      |
| 14  | ✅ **Catálogo de aumentos**, sobre la pestaña de estadísticas existente: ahora lista los 554 aumentos y no solo los vistos, con un interruptor de «solo los que he usado» y la descripción al desplegar cada fila.                                                                    | S–M    |
| 15  | ✅ **Fichas de campeón.** Título, roles, las cinco habilidades con su texto, tus datos con él y tus últimas partidas. Enlazadas desde el historial al desplegar una partida y desde el nombre en la tabla de campeones.                                                               | M      |
| 16  | ✅ **Marcas de parche en Tendencias.** Línea vertical en el tramo donde empieza cada parche que jugaste, en las dos gráficas cronológicas; la etiqueta se cae cuando no cabe.                                                                                                         | S      |

## Hito 4 — Entender tus partidas (v0.7.0)

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

## Hito 5 — Datos y puntuación (v0.8.0)

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
