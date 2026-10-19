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
