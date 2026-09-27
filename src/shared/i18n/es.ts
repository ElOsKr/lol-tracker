import type { Dictionary } from "./en";

export const es: Dictionary = {
  "language.system": "Como Windows",
  "language.en": "Inglés",
  "language.es": "Español",

  // Barra lateral
  "nav.history": "Historial",
  "nav.live": "Partida en directo",
  "nav.champions": "Campeones",
  "nav.augments": "Aumentos",
  "nav.friends": "Amigos",
  "nav.trends": "Tendencias",
  "nav.records": "Récords",
  "nav.widget": "Widget / OBS",
  "nav.challenges": "Desafíos",
  "nav.global": "Estadísticas totales",
  "nav.settings": "Ajustes",
  "sidebar.tracker": "Tracker",
  "sidebar.sync": "Sincronizar",
  "sidebar.syncing": "Sincronizando...",
  "sidebar.cancel": "Cancelar",
  "sidebar.importing": "Importando historial...",
  "sidebar.importingProgress": "Importando historial {current}/{total}",
  "sidebar.importFailed": "Error al importar: {error}",
  "sidebar.importStopped": "Importación detenida tras {count} partida(s)",
  "sidebar.imported": "Importadas {count} partida(s) antiguas",
  "sidebar.foundNew": "{count} partida(s) nueva(s)",
  "sidebar.noNew": "No hay partidas nuevas",
  "sidebar.error": "Error: {error}",
  "sidebar.updateAvailable": "v{version} disponible",
  "status.connected": "Conectado",
  "status.ingame": "En partida",
  "status.connecting": "Conectando...",
  "status.disconnected": "Desconectado",

  // Controles de ventana
  "window.minimize": "Minimizar",
  "window.maximize": "Maximizar",
  "window.restore": "Restaurar",
  "window.close": "Cerrar",

  // Barra de cola
  "queue.label": "Cola",
  "queue.saveFailed": "No se pudo guardar la cola",
  "queue.noAugments":
    "Esta cola no utiliza los aumentos de Mayhem. Elige ARAM Caos para consultar sus estadísticas.",

  // Diálogo de actualización
  "update.title": "Actualización disponible",
  "update.body": "La versión {latest} está disponible (tienes la {current}).",
  "update.downloading": "Descargando... {progress}%",
  "update.downloadingOf": "Descargando... {progress}% de {size} MB",
  "update.manual": "Descargar a mano",
  "update.viewOnGithub": "Ver en GitHub",
  "update.notNow": "Ahora no",
  "update.install": "Actualizar y reiniciar",
  "update.installing": "Actualizando...",
  "update.failed": "La actualización ha fallado",
  "update.noNotes": "Esta versión no tiene notas.",
  "update.noDownload": "Esta versión no tiene descarga",
  "update.versionsSince": "{count} versiones de cambios desde tu instalación",
  "update.moreOnGithub": ", y otras anteriores en GitHub",

  // Settings
  "settings.title": "Ajustes",
  "settings.general": "General",
  "settings.language": "Idioma",
  "settings.languageDesc":
    "El idioma de la interfaz. «Como Windows» sigue el idioma del sistema y, si no es español, usa inglés.",
  "settings.autoStart": "Arrancar con Windows",
  "settings.autoStartDesc":
    "Abrir el programa en la bandeja del sistema al iniciar sesión en Windows, para que tus partidas se registren sin tener que acordarte de abrirlo.",
  "settings.autoStartOnlyPackaged": " Solo disponible en el programa instalado.",
  "settings.minimizeToTray": "Minimizar a la bandeja al cerrar",
  "settings.minimizeToTrayDesc":
    "Si está activado, el programa sigue guardando tus partidas aunque cierres la ventana. Puedes salir del todo desde la bandeja del sistema.",
  "settings.rememberFilters": "Recordar filtros y orden",
  "settings.rememberFiltersDesc":
    "Reabrir cada página con los filtros, la búsqueda y el orden que usaste la última vez. Si está desactivado, cada página vuelve a sus valores por defecto al abrir el programa.",
  "settings.hideRemakes": "Ocultar remakes",
  "settings.hideRemakesDesc":
    "Dejar fuera del historial las partidas canceladas por remake. Se guardan igualmente y nunca contaron para tus estadísticas.",
  "settings.grouping": "Agrupar el historial por",
  "settings.groupingDesc":
    "Divide la lista de partidas en sesiones, cada una con su propio balance y sus medias. Los días empiezan a las 5 de la mañana; las semanas van de lunes a domingo.",
  "grouping.day": "Día",
  "grouping.week": "Semana",
  "grouping.patch": "Parche",
  "grouping.none": "Sin agrupar",
  "settings.queueNote":
    "La cola se elige en el selector superior y se conserva al reiniciar. No se mezclan las estadísticas de distintas colas.",
  "settings.sidebar": "Barra lateral",
  "settings.sidebarDesc":
    "Elige qué páginas aparecen en la barra lateral y en qué orden. Ajustes se queda siempre, para que puedas volver aquí.",
  "settings.moveUp": "Subir {label}",
  "settings.moveDown": "Bajar {label}",
  "settings.startPage": "Página de inicio",
  "settings.startPageDesc":
    "La página que se abre al arrancar el programa. Solo se pueden elegir las que aparecen en la barra lateral.",
  "settings.data": "Datos",
  "settings.backfill": "Recuperar el historial",
  "settings.backfillDesc":
    "Trae de Riot tus partidas disponibles y añade las que aún no estén guardadas. Se ejecuta solo la primera vez que se conecta una cuenta; úsalo para repetirlo o para terminar una importación cancelada.",
  "settings.working": "Trabajando...",
  "settings.backfillButton": "Recuperar",
  "settings.export": "Exportar datos",
  "settings.exportDesc": "Guardar todas las partidas en un archivo JSON como copia de seguridad",
  "settings.exportButton": "Exportar",
  "settings.import": "Importar datos",
  "settings.importDesc": "Cargar partidas desde un archivo exportado antes",
  "settings.importButton": "Importar",
  "settings.repair": "Reparar datos de cuentas",
  "settings.repairDesc":
    "Vuelve a detectar qué cuentas son tuyas analizando el historial, y reconstruye estadísticas, aumentos y notas a partir de los datos originales. Úsalo si hay partidas atribuidas a la cuenta equivocada o las notas parecen desfasadas.",
  "settings.repairButton": "Reparar",
  "settings.backups": "Copias de seguridad",
  "settings.autoBackup": "Copias automáticas",
  "settings.autoBackupDesc":
    "Guarda una copia diaria de tu base de datos en este ordenador, más una antes de cada importación o reparación. Las copias antiguas se reducen a semanales y mensuales. Si la base de datos desaparece o no abre, al arrancar se restaura la copia buena más reciente.",
  "settings.noBackups": "Todavía no hay copias.",
  "backup.reason.auto": "Programada",
  "backup.reason.manual": "Manual",
  "backup.reason.pre-import": "Antes de importar",
  "backup.reason.pre-repair": "Antes de reparar",
  "backup.reason.pre-restore": "Antes de restaurar",
  "settings.unreadable": "ilegible",
  "settings.gamesCount": "{count} partidas",
  "settings.replaceCurrent": "¿Sustituir los datos actuales?",
  "settings.restore": "Restaurar",
  "settings.cancel": "Cancelar",
  "settings.backupNow": "Copiar ahora",
  "settings.openFolder": "Abrir carpeta",
  "settings.backedUp": "Copiadas {count} partida(s)",
  "settings.errorWith": "Error: {error}",
  "settings.backupFailed": "la copia ha fallado",
  "settings.restored": "Restauradas {count} partida(s) desde {file}",
  "settings.restoreFailed": "la restauración ha fallado",
  "settings.exported": "Exportadas {count} partida(s) a {path}",
  "settings.importedNew": "Importadas {count} partida(s) nuevas",
  "settings.nothingNew": "No hay nada nuevo que comprobar",
  "settings.checking": "Comprobando la partida {current} de {total}; {added} añadidas hasta ahora",
  "settings.fetchingList": "Pidiendo a Riot tu lista de partidas...",
  "settings.backfillAdded":
    "Añadidas {added} partida(s) de las {scanned} encontradas en tu historial de Riot",
  "settings.backfillNone": "No hay partidas nuevas de LoL ({scanned} comprobadas)",
  "settings.backfillStopped":
    "Detenido tras añadir {added} partida(s). Vuelve a ejecutarlo para terminar.",
  "settings.backfillService":
    "{summary}. Riot solo sirve tus {cap} partidas más recientes de cualquier cola, así que no se puede importar nada anterior; a partir de ahora, cada partida nueva se conserva.",
  "settings.backfillPaging":
    "{summary}. Se paró en el límite de paginación de {scanned} partidas, así que lo anterior no se ha comprobado.",
  "settings.repaired":
    "Reparadas {games} partida(s), encontradas {accounts} cuenta(s), reconstruidas estadísticas y notas de {rebuilt} partida(s)",
};
