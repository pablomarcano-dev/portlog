export type ChangelogStatus = 'verified-local' | 'verified-production' | 'partial' | 'deferred';

export const CHANGELOG_STATUS = {
  'verified-local': { label: 'Implementado · verificado localmente', color: 'blue' },
  'verified-production': { label: 'Desplegado · conservación verificada', color: 'green' },
  partial: { label: 'Verificación parcial', color: 'yellow' },
  deferred: { label: 'Aplazamiento aprobado', color: 'gray' },
} as const satisfies Record<ChangelogStatus, { label: string; color: string }>;

interface ChangelogSection {
  readonly id: string;
  readonly title: string;
  readonly status: ChangelogStatus;
  readonly items: readonly string[];
  readonly verification?: string;
}

export interface ChangelogEntry {
  readonly id: string;
  // An editorial calendar date, not an instant: never derive it from the reader's timezone.
  readonly date: string;
  readonly dateLabel: string;
  readonly timeZone: 'America/Montevideo';
  readonly title: string;
  readonly deployment: 'pending' | 'deployed';
  readonly releaseNote: string;
  readonly qaSummary: {
    readonly verified: number;
    readonly partial: number;
    readonly deferred: number;
  };
  readonly sections: readonly ChangelogSection[];
}

// User-facing release notes only. Keep internal audit details and operational data in docs/.
// Sources and verification boundaries: docs/CHANGELOG.md.
export const changelogEntries: readonly ChangelogEntry[] = [
  {
    id: '2026-10-28-clarified-video',
    date: '2026-10-28',
    dateLabel: '28 de octubre de 2026',
    timeZone: 'America/Montevideo',
    title: 'Requisitos aclarados en la revisión de los videos',
    deployment: 'deployed',
    releaseNote:
      'Requisitos aclarados en los videos: destinatarios del capitán, documentos de terminal y Recap, búsqueda de actividades y etiquetas. Se conservan las nominaciones y los archivos históricos.',
    qaSummary: { verified: 8, partial: 0, deferred: 0 },
    sections: [
      {
        id: 'clarified-requirements',
        title: 'Destinatarios, documentos y formularios',
        status: 'verified-local',
        items: [
          'Pre-arrival se dirige al contacto del capitán o, si no tiene correos, a los buzones del buque. Sin direcciones, Para queda vacío. Se mantienen las copias expresas y de la sucursal.',
          'Las nuevas nominaciones ofrecen Owner’s Agents y Charterer’s Agents. Full Agency se conserva visible en registros históricos sin reclasificarlos.',
          'El mensaje ETA al terminal conserva SERVICIOS NAVIERAMAR, C.A. y elimina el sufijo OPERATIONS.',
          'Las etiquetas de bombas se muestran completas y las cifras distinguen lo ofrecido por el terminal de lo solicitado por el buque.',
          'La búsqueda de actividades reconoce NOR y arrival, conserva la selección guardada ante errores y permite reintentar.',
          'Recap permite elegir mensajes ETA/NOR enviados y sus adjuntos guardados. Los PDF nuevos se crean desde el contenido archivado, no desde los datos actuales; los archivos históricos faltantes se indican.',
          'Cada terminal dispone de una biblioteca de documentos pre-arrival en Master Data → Ports. Se eligen antes de enviar; retirar un documento conserva su archivo y las copias enviadas.',
          'La opción Print / save as PDF after sending explica cómo guardar el mensaje confirmado en la carpeta digital del buque. También sigue disponible imprimir desde Messages.',
        ],
        verification:
          'Pruebas automatizadas y de navegador con datos simulados; PDF de cinco páginas y migración aditiva ensayada sin alterar datos existentes. Sin correos reales ni cambios en producción. Los documentos oficiales deben cargarse en la biblioteca correspondiente.',
      },
    ],
  },
  {
    id: '2026-10-27-routing-defaults',
    date: '2026-10-27',
    dateLabel: '27 de octubre de 2026',
    timeZone: 'America/Montevideo',
    title: 'Contacto del capitán y grupos por nominación',
    deployment: 'deployed',
    releaseNote:
      'La nominación permite seleccionar el contacto del capitán, cambiar los grupos de sus mensajes y asignar un grupo de copia permanente. No se asignan contactos ni grupos automáticamente a nominaciones existentes.',
    qaSummary: { verified: 4, partial: 0, deferred: 0 },
    sections: [
      {
        id: 'routing-defaults',
        title: 'Contactos y destinatarios',
        status: 'verified-local',
        items: [
          'Capitán: se puede vincular un contacto. Sus correos se usan para las solicitudes y respuestas ETA al capitán; si no tiene correos se utilizan los del buque. Sin ninguna dirección, Para queda vacío para selección expresa. Editar el nombre manualmente desvincula el contacto.',
          'Grupos: el primer, segundo y tercer mensaje permiten elegir un grupo para esta nominación. Al quitar la selección vuelven los grupos del cliente asignado. La composición del grupo sigue perteneciendo al directorio compartido.',
          'Copia permanente: el grupo elegido expresamente y los correos de la sucursal se incluyen en CC en los nuevos envíos operativos. Se eliminan duplicados entre Para, CC y CCO. Los reenvíos históricos conservan sus destinatarios archivados.',
          'Reply to Master: permite elegir el capitán/buque o un grupo asignado para el borrador. Elegir no envía; cada Send envía un solo mensaje. Una actualización de la consulta no sustituye los cambios del remitente.',
        ],
        verification:
          'Pruebas automatizadas y de interfaz con datos simulados; migración aditiva ensayada en una copia aislada. No se enviaron correos reales. Los contactos y grupos vinculados deben desvincularse antes de eliminarlos del directorio.',
      },
    ],
  },
  {
    id: '2026-10-27-sof-routing',
    date: '2026-10-27',
    dateLabel: '27 de octubre de 2026',
    timeZone: 'America/Montevideo',
    title: 'SOF coherente, destinatarios del terminal y datos del buque',
    deployment: 'deployed',
    releaseNote:
      'Actualización de SOF, instrucciones, destinatarios y datos Datalastic. El SOF interino se distingue del final; los documentos históricos y los datos existentes se conservan.',
    qaSummary: { verified: 7, partial: 0, deferred: 0 },
    sections: [
      {
        id: 'sof',
        title: 'Estado de hechos',
        status: 'verified-local',
        items: [
          'Eventos: la vista previa, el correo y el nuevo PDF utilizan el Times Sheet guardado. Los cambios actuales se guardan antes de preparar el mensaje y se validan las fechas y horas de las actividades.',
          'SOF interino y final: cada versión tiene su propia acción. El interino mantiene abierta la escala. Los cuatro controles de inclusión se respetan en el correo y el PDF; los cálculos de tiempo requieren selección expresa y no se incluyen en el interino.',
          'Contenido: se incluyen las cifras ofrecidas/solicitadas de parcelas, las actividades Safe Key Meeting, las partes y comentarios de las cartas y los períodos y textos de las demoras guardadas.',
          'Recuperación: una ventana de datos complementarios permanece abierta si falla el guardado para permitir reintentar sin perder lo escrito.',
        ],
        verification:
          'Pruebas automatizadas, comprobaciones de interfaz con datos de prueba y revisión visual de un PDF sintético. No se enviaron correos reales.',
      },
      {
        id: 'defaults-and-vessels',
        title: 'Instrucciones, destinatarios y buques',
        status: 'verified-local',
        items: [
          'Terminal: su lista figura en Para una sola vez; los destinatarios predeterminados se añaden a CC. Se eliminan duplicados entre Para, CC y CCO, incluso al enviar.',
          'Instruction client: toma Charterers como predeterminado y permite elegir otra empresa en el panel derecho; se conservan las selecciones diferentes.',
          'Datalastic: se validan los campos utilizados para SDWT, GRT y LOA sin depender de otros metadatos. Al crear un buque, los valores son revisables y se guardan con su ficha. No se actualizan registros históricos en masa.',
        ],
        verification:
          'Contratos, servicios y comprobaciones de interfaz con respuestas simuladas. El nuevo tipo de envío interino se ensayó en una copia aislada sin modificar los registros existentes.',
      },
    ],
  },
  {
    id: '2026-10-27-followup',
    date: '2026-10-27',
    dateLabel: '27 de octubre de 2026',
    timeZone: 'America/Montevideo',
    title: 'Entrada de horas y protección al completar nominaciones',
    deployment: 'deployed',
    releaseNote:
      'Segunda actualización del 27 de octubre. Mejora la entrada de horas ETA, evita crear una nominación por Enter al introducir cifras y permite reintentar la carga de los directorios opcionales al dar de alta clientes. No requiere migraciones de datos.',
    qaSummary: { verified: 2, partial: 2, deferred: 0 },
    sections: [
      {
        id: 'entry-safeguards',
        title: 'Horas ETA y datos numéricos',
        status: 'verified-local',
        items: [
          'ETA: los cuatro campos de fecha y hora utilizan entrada explícita de 24 horas HH:mm, incluidos 20:00 y 00:00. Una hora incompleta o inválida impide guardar o abrir el mensaje hasta corregirla. Se conserva la conversión de zona horaria existente.',
          'Nominaciones: Enter dentro de un campo numérico ya no envía el formulario accidentalmente. El botón Crear sigue funcionando mediante clic o Enter cuando tiene el foco; no se añaden campos obligatorios.',
        ],
        verification:
          'Comprobaciones locales con datos de prueba, incluidas las cuatro horas ETA en configuraciones en-US/Caracas y es-VE/Montevideo. No se enviaron correos reales.',
      },
      {
        id: 'client-loading-and-terminal-review',
        title: 'Carga de directorios y revisión de destinatarios',
        status: 'partial',
        items: [
          'Alta de clientes: se muestran la carga y los fallos de contactos y grupos opcionales, con un botón para reintentar sin borrar lo escrito. Se verificó el alta sin correos ni grupos; el bloqueo original descrito en la revisión no pudo reproducirse.',
          'Destinatarios del terminal: se comprobaron el cambio de terminal guardado y la eliminación de duplicados dentro de Para, CC y CCO. No se modificaron las reglas de envío: la lista del puerto sigue figurando en Para y CC de ETA; revisar esa repetición entre campos queda pendiente.',
        ],
        verification:
          'Pruebas automatizadas y comprobaciones de interfaz con servicios simulados. Esta revisión no certifica la exactitud del directorio operativo ni la entrega externa de correo.',
      },
    ],
  },
  {
    id: '2026-10-27',
    date: '2026-10-27',
    dateLabel: '27 de octubre de 2026',
    timeZone: 'America/Montevideo',
    title: 'Ajustes en nominaciones y selección de destinatarios',
    deployment: 'deployed',
    releaseNote:
      'Actualización del 27 de octubre de 2026. Los ajustes se verificaron con pruebas automatizadas y comprobaciones locales de interfaz con datos de prueba. Se conservan las selecciones y los textos introducidos manualmente; no se requieren migraciones de datos.',
    qaSummary: { verified: 7, partial: 0, deferred: 0 },
    sections: [
      {
        id: 'nomination-details',
        title: 'Buques, responsables y documentos',
        status: 'verified-local',
        items: [
          'Banderas: la búsqueda por IMO reconoce el código o el nombre del país, muestra la bandera encontrada y conserva una selección manual. Si no encuentra una coincidencia, indica que debe seleccionarse manualmente.',
          'Responsable M.I.C.: se prioriza al gerente de la sucursal sobre el supervisor. Los valores elegidos manualmente se conservan al cambiar de sucursal.',
          'Asunto: los asuntos generados de nuevas nominaciones incorporan los cambios de referencia. Un asunto editado manualmente se conserva; Generar permite actualizarlo expresamente.',
          'Nomination Instructions: los campos Owner y Operator utilizan los participantes indicados en la nominación cuando falta el nombre en la ficha del buque. Los campos sin información quedan en blanco.',
        ],
        verification:
          'Pruebas de servicios, generación de instrucciones y comprobaciones locales de interfaz. El filtro existente de puertos por sucursal también se comprobó con datos de prueba.',
      },
      {
        id: 'message-selection',
        title: 'Grupos de mensajes y alta de clientes',
        status: 'verified-local',
        items: [
          'Grupos de correo: las opciones destacan el primer, segundo y tercer mensaje de la nominación y explican cómo añadir sus destinatarios a Para, CC o CCO. La selección sigue a cargo del remitente.',
          'Recuperación: se puede reintentar una carga fallida de grupos. Un grupo sin direcciones no borra los destinatarios ya escritos.',
          'Alta de clientes: la ventana aclara que crea una empresa en el directorio compartido y que los grupos de correo son opcionales.',
        ],
        verification:
          '266 pruebas automatizadas, comprobación de tipos, compilación y revisión de código satisfactorias. Se comprobaron selección de grupos, destinatarios y recuperación en un navegador con servicios de prueba; no se enviaron correos reales.',
      },
    ],
  },
  {
    id: '2026-10-15',
    date: '2026-10-15',
    dateLabel: '15 de octubre de 2026',
    timeZone: 'America/Montevideo',
    title: 'Mejoras en nominaciones, comunicaciones y documentos',
    deployment: 'deployed',
    releaseNote:
      'Desplegado en producción el 19 de octubre de 2026. Se comprobaron el inicio del servicio y la conservación de los datos y archivos existentes. Las comprobaciones funcionales indicadas conservan el alcance descrito; no equivalen a una validación completa de todos los flujos.',
    qaSummary: { verified: 10, partial: 1, deferred: 2 },
    sections: [
      {
        id: 'nominations',
        title: 'Nominaciones y datos maestros',
        status: 'verified-local',
        items: [
          'Puertos: se puede guardar un puerto sin asignarle sucursal (Branch); el nombre sigue siendo obligatorio. Al elegir una sucursal en la nominación, la lista de puertos se filtra por esa selección.',
          'Alta desde la nominación: se pueden crear Charterer, Owner y Commercial Operator sin salir del formulario.',
          'Buques: se eliminó el campo Abbreviation de los formularios, conservando los datos históricos.',
          'Clientes y mensajes: se puede asignar el primer, segundo y tercer mensaje por cliente para las instrucciones de nominación. Las ventanas Action ofrecen los grupos asignados y muestran su orden. Las nominaciones existentes requieren revisar y asignar esos grupos.',
          'ETA’s Recaps & NOR: nueva acción de composición con asunto precargado y una guía para adjuntar y revisar ambos documentos. Los adjuntos se incorporan manualmente; no se generan automáticamente.',
          'Avisos ETA: el intervalo se calcula con las horas restantes y los escalones de 96, 72, 48, 24 y 12 horas, incluidos los casos de menos de 12 horas y ETA vencida.',
        ],
        verification:
          'Comprobaciones locales de interfaz con Playwright y pruebas automatizadas. La prueba de navegador de ETA cubrió un caso representativo; no se validaron todos los escenarios horarios ni el formato final de las instrucciones.',
      },
      {
        id: 'email',
        title: 'Correos, adjuntos e impresión',
        status: 'verified-local',
        items: [
          'Carga de archivos: las selecciones simultáneas conservan los adjuntos y respetan los límites. Mientras hay cargas pendientes se bloquean el envío y el cierre del compositor.',
          'Revisión de adjuntos: los PDF admitidos pueden previsualizarse y descargarse antes del envío; los tipos no admitidos se rechazan.',
          'Historial y reenvío: se guarda una copia de los adjuntos de cada mensaje. El reenvío conserva el contenido y los destinatarios originales, incluidos CC y CCO, y utiliza los archivos archivados.',
          'Documentos originales: si falta un PDF requerido o no se puede confirmar si el mensaje original lo incluía, el reenvío se bloquea para evitar mensajes incompletos. Los archivos faltantes requieren revisión; no se reconstruyen automáticamente.',
          'Reintentos: una misma solicitud desde la misma pestaña conserva su resultado confirmado, incluso tras reiniciar el servicio. Si el resultado del envío es incierto, se requiere revisión antes de volver a enviar; no se garantiza la entrega al destinatario.',
          'Preparación de envíos: los archivos necesarios se comprueban antes de enviar. Los fallos de preparación de documentos SH permiten reintentar sin marcar el documento como enviado; dos intentos concurrentes no pueden enviarlo a la vez.',
          'Imprimir después de enviar: tras un envío confirmado se abre un recibo imprimible con los datos y el contenido del correo.',
        ],
        verification:
          'Carga, vista previa e impresión comprobadas con navegador y servicios locales de prueba. Reenvío, recuperación y concurrencia comprobados con pruebas automatizadas y una base aislada. SH sigue sin navegación integrada y se verificó de forma aislada. No se certificó correo externo ni impresión física.',
      },
      {
        id: 'preservation',
        title: 'Conservación de datos y puesta en producción',
        status: 'verified-production',
        items: [
          'Antes del despliegue se restauraron copias actuales de la base de datos y del almacenamiento en un entorno aislado. Los cambios conservaron los valores originales y sus relaciones; repetir su aplicación no produjo cambios adicionales.',
          'Durante la puesta en producción se comprobó la conservación de los datos originales y de todas las versiones existentes de los archivos. No se reiniciaron ni reemplazaron los datos operativos. Los mensajes históricos con archivos faltantes o de origen desconocido conservan las limitaciones de reenvío indicadas arriba.',
        ],
        verification:
          'Despliegue y conservación verificados en producción el 19 de octubre de 2026. Esto no certifica todos los flujos de la aplicación, la entrega de correo externo ni la impresión física.',
      },
      {
        id: 'deferred',
        title: 'Pendiente de materiales aprobados',
        status: 'deferred',
        items: [
          'Materiales Pre-Arrival: aplazados hasta recibir ejemplos, la lista de documentos y las reglas aprobadas del paquete.',
          'Reply to Client: aplazado hasta recibir la plantilla aprobada y las reglas de destinatarios y adjuntos.',
        ],
      },
    ],
  },
];
