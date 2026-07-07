---
# Portlog — Manual de Usuario: Nominaciones

Esta guía recorre el ciclo de vida completo de una **Nominación** en Portlog: desde la creación inicial hasta la confirmación, el seguimiento de progreso y la finalización (o cancelación). Ambos roles — **OPS** y **ADM** — tienen acceso completo a todos los pasos aquí descritos.
---

## Tabla de Contenidos

1. [¿Qué es una Nominación?](#1-qué-es-una-nominación)
2. [Ciclo de Vida de una Nominación](#2-ciclo-de-vida-de-una-nominación)
3. [Visualización de la Lista de Nominaciones](#3-visualización-de-la-lista-de-nominaciones)
4. [Creación de una Nominación](#4-creación-de-una-nominación)
5. [Visualización de una Nominación](#5-visualización-de-una-nominación)
6. [Edición de una Nominación](#6-edición-de-una-nominación)
7. [Gestión de la Lista de Clientes](#7-gestión-de-la-lista-de-clientes)
8. [Transición de Estado](#8-transición-de-estado)
9. [Gestión de Carga (Parcelas)](#9-gestión-de-carga-parcelas)
10. [Respuesta a un ETA](#10-respuesta-a-un-eta)
11. [Envío de Correos Electrónicos](#11-envío-de-correos-electrónicos)
12. [Visualización del Registro de Mensajes](#12-visualización-del-registro-de-mensajes)
13. [Auditoría del Historial de Estados](#13-auditoría-del-historial-de-estados)

---

## 1. ¿Qué es una Nominación?

Una **Nominación** representa la escala portuaria de un buque gestionada por la agencia. Es el registro central que vincula:

- El **buque** (características del barco) y los detalles del viaje
- Los **puertos** involucrados (puerto operativo, muelle, último puerto, próximo puerto, puerto de descarga)
- Las **partes** involucradas (armadores, fletadores, corredor, capitán, inspectores)
- La **carga** que se está embarcando o descargando (parcelas)
- Los **destinatarios de correo** para todas las comunicaciones salientes
- El **PEDR** (Registro de Entrada/Salida de Puerto), documentos portuarios SH-xx y Estado de Hechos

A cada nominación se le asigna un número **SN** único (por ejemplo, `5`) generado automáticamente al momento de su creación, utilizado como referencia **SN/OT**.

---

## 2. Ciclo de Vida de una Nominación

Una nominación avanza a través de los siguientes estados. Solo se permiten las transiciones indicadas.

```
DRAFT
  ├─→ CONFIRMED     (acción: Confirm)
  └─→ CANCELLED     (acción: Cancel — se requiere motivo)

CONFIRMED
  ├─→ IN PROGRESS   (acción: Start)
  └─→ CANCELLED     (acción: Cancel — se requiere motivo)

IN PROGRESS
  ├─→ COMPLETED     (acción: Complete)
  └─→ CANCELLED     (acción: Cancel — se requiere motivo)

COMPLETED  ← terminal, no se permiten más cambios
CANCELLED  ← terminal, no se permiten más cambios
```

Las etiquetas de estado están codificadas por colores en toda la aplicación:

| Estado      | Color         |
| ----------- | ------------- |
| Draft       | Gris          |
| Confirmed   | Azul          |
| In Progress | Naranja/Ámbar |
| Completed   | Verde         |
| Cancelled   | Rojo          |

---

## 3. Visualización de la Lista de Nominaciones

Navegue a **Nominations** en la barra de navegación superior para acceder a la página de lista.

![Nominations list showing SN/OT, Voyage Number, Vessel, Op Port, Date Nominated, Status, and Created At columns with four active nominations visible](screenshots/nominations/01b_nominations_list_viewport.png)

### Columnas

| Columna        | Descripción                                      |
| -------------- | ------------------------------------------------ |
| SN/OT          | Número generado automáticamente (por ejemplo, 5) |
| Voyage Number  | Identificador del viaje (por ejemplo, 005/NPA)   |
| Vessel         | Nombre del buque y señal de llamada              |
| Op Port        | Código del puerto operativo                      |
| Date Nominated | Fecha de nominación                              |
| Status         | Etiqueta codificada por color                    |
| Created At     | Fecha de creación del registro                   |

### Filtros y Búsqueda

La barra de filtros se ubica directamente debajo del título de la página:

- **Status** — filtrar por un estado (Todos los estados / Draft / Confirmed / In Progress / Completed / Cancelled)
- **Port** — filtrar por puerto operativo
- **Vessel** — filtrar por nombre del buque
- **Date from / Date to** — filtrar por rango de fechas de nominación
- **Search** — búsqueda de texto libre sobre número de viaje, nombre del buque o referencia SN

El interruptor **"Nominaciones activas únicamente (In Progress + Confirmed)"** (arriba a la derecha, activado por defecto) oculta los registros COMPLETED, CANCELLED y DRAFT. Desactívelo para ver todos los registros.

Haga clic en **Clear filters** para restablecer todos los filtros a la vez.

La paginación aparece en la parte inferior derecha cuando hay más resultados de los que caben en una página.

---

## 4. Creación de una Nominación

Haga clic en **New Nomination** (botón azul, arriba a la derecha de la página de lista) para abrir el formulario de creación.

![New Nomination form showing all field groups: Number/Branch/Lay Days row, Ship's Name/Nom. Date/Type row, port fields, people fields, Subject, and the Clients table pre-populated with default rows](screenshots/nominations/12_new_nomination_form_top.png)

### Campos Obligatorios

| Campo           | Notas                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| **Ship's Name** | Seleccionar de la lista maestra de buques. Haga clic en **+** para agregar una búsqueda AIS. |
| **Nom. Date**   | Fecha de nominación (obligatoria).                                                           |
| **Type**        | Por defecto, **Full Agency**.                                                                |

### Campos Opcionales — Viaje y Puertos

| Campo         | Notas                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Number        | Asignado automáticamente (se muestra como "Auto" hasta que se guarda).                           |
| Branch        | Sucursal que gestiona esta nominación. Habilita el panel de Documentos de Sucursal.              |
| Lay Days      | Rango de fechas de inicio/fin para los días de plancha.                                          |
| Nom. Reply    | Fecha en que se acusó recibo de la nominación.                                                   |
| Oper. Port    | Puerto operativo principal. El Muelle estará disponible una vez que se seleccione el Oper. Port. |
| Pier          | Muelle o atraque específico. Requiere Oper. Port primero.                                        |
| External Port | Referencia de puerto externo alternativo.                                                        |
| Last Port     | Puerto de escala anterior.                                                                       |
| Next Port     | Próximo puerto tras esta escala.                                                                 |
| E.T.A.        | Fecha y hora estimadas de arribo.                                                                |

### Campos Opcionales — Personas

| Campo           | Notas                              |
| --------------- | ---------------------------------- |
| M.I.C.          | Código del oficial MIC.            |
| Boarding        | Nombre del despachador de a bordo. |
| Mobile on Board | Teléfono de contacto del buque.    |
| Captain         | Nombre del capitán del buque.      |
| Inspector       | Nombre del inspector portuario.    |
| Reference Nº    | Referencia de texto libre.         |

### Asunto

Plantilla de asunto de correo electrónico opcional. Haga clic en **Generate** para completarlo automáticamente con los datos de la nominación.

### Tabla de Clientes

La tabla de Clientes viene precargada con los tipos de partes predeterminados (Head Owner, Charterer, Disponent Owner, etc.). Complete los nombres y referencias para cada parte relevante. Puede agregar filas adicionales o eliminar las que no utilice.

### Envío del Formulario

Desplácese hasta el final y haga clic en **Create Nomination**. La nominación se crea en estado **DRAFT** y se le asigna su número SN. Será redirigido a la página de detalle.

---

## 5. Visualización de una Nominación

Haga clic en cualquier fila de la lista de nominaciones para abrir la página de detalle.

![Nomination detail page for #5 — MV Liberian Star (IN_PROGRESS) showing the Nomination Details form expanded with all fields, the Parcels section with Soja and Maíz rows, and the right rail with Save Changes, Status History, and Actions panel](screenshots/nominations/03_nomination_detail_full.png)

### Disposición de la Pantalla

**Encabezado (parte superior)**

- Número de nominación y número de viaje (por ejemplo, **Nomination #5 — 005/NPA**)
- Nombre del buque y etiqueta de estado debajo del título
- Botones de transición de estado en la parte superior derecha (por ejemplo, **Complete**, **Cancel**)

**Panel izquierdo (contenido principal)**

- **Nomination Details** — formulario contraíble con todos los campos de la nominación y las parcelas
- **Clients** — tabla de lista de clientes contraíble
- **Messages** — registro de despacho de correos contraíble

**Panel derecho**

- **Save Changes** — botón azul para guardar los cambios
- **Status History** — auditoría contraíble del historial
- **Actions** — botones de acción para correos (Acknowledgement, Prearrival, E.T.A., Cargo Update, Statement of Facts, NOR)

---

## 6. Edición de una Nominación

Las nominaciones en estado **DRAFT**, **CONFIRMED** o **IN PROGRESS** pueden editarse. Las nominaciones COMPLETED y CANCELLED son de solo lectura.

![Nomination Details form showing all fields: Branch (Nueva Palmira), Ship's Name (MV Liberian Star), Nom. Date, Type (Full Agency), Oper. Port (Nueva Palmira), Pier (Terminal Fluvial), Next Port (Buenos Aires), ETA, Captain, and the Parcels section at the bottom](screenshots/nominations/07_status_history.png)

1. En la página de detalle, la sección **Nomination Details** se muestra expandida por defecto — edite cualquier campo directamente.
2. Haga clic en **Save Changes** (botón azul en el panel derecho) para guardar los cambios.
3. La flecha **▲/▼** junto al encabezado de cada sección contrae o expande dicha sección.

> Si la nominación se encuentra en un estado terminal (COMPLETED o CANCELLED), el botón Save Changes se oculta y todos los campos pasan a ser de solo lectura.

---

## 7. Gestión de la Lista de Clientes

La sección **Clients** registra todas las partes involucradas en la nominación.

![Clients section expanded showing the Client List table with columns: Type, Name, Voy., Ref. No., Proforma, Broker — with rows for Head Owner, Charterer, Disponent Owner, Technical Operator, Commercial Oper., Manning Agents, Catering Agents, Time Charter (Viterra Uruguay S.A.), Ship Management, Broker (BRS Brokers / Pierre Dumont), Hub Agents, Administrative Ag.](screenshots/nominations/06_clients_section.png)

### Columnas

| Columna  | Descripción                                                         |
| -------- | ------------------------------------------------------------------- |
| Type     | Tipo de parte (etiqueta de solo lectura para filas predeterminadas) |
| Name     | Nombre de la empresa o parte — haga clic para editar                |
| Voy.     | Referencia de viaje para esta parte                                 |
| Ref. No. | Número de referencia interno de la parte                            |
| Proforma | Número de factura proforma                                          |
| Broker   | Nombre del corredor asociado                                        |

### Edición

Todas las celdas de **Name**, **Voy.**, **Ref. No.**, **Proforma** y **Broker** son editables — haga clic en una celda para editarla, luego presione Tab o haga clic fuera para guardar.

### Agregar una Fila

Haga clic en **+ Add row** al final de la tabla. Se agregará una fila en blanco con el campo Type vacío.

### Eliminar una Fila

Haga clic en la **×** roja al final de la fila.

> La lista de Clientes completa (incluidas las filas con nombres vacíos) se guarda automáticamente al hacer clic en **Save Changes** en el panel derecho.

---

## 8. Transición de Estado

Los botones de transición de estado aparecen en la parte superior derecha del encabezado de la nominación.

### IN PROGRESS — Completar o Cancelar

![Nomination #5 IN_PROGRESS header showing green "Complete" and red-bordered "Cancel" buttons](screenshots/nominations/04_nomination_detail_header.png)

Los botones que se muestran dependen del estado actual:

| Estado      | Botones disponibles |
| ----------- | ------------------- |
| Draft       | Confirm, Cancel     |
| Confirmed   | Start, Cancel       |
| In Progress | Complete, Cancel    |
| Completed   | _(ninguno)_         |
| Cancelled   | _(ninguno)_         |

Haga clic en el botón de acción principal (**Confirm**, **Start** o **Complete**) para avanzar la nominación — no se muestra ningún diálogo de confirmación.

### Cancelación

Haga clic en **Cancel** en cualquier estado activo. Aparecerá un modal:

![Cancel Nomination modal with "Reason for cancellation" required text area, "Back" button, and red "Confirm Cancellation" button](screenshots/nominations/11_cancel_modal.png)

1. Ingrese el **motivo de cancelación** en el área de texto (obligatorio — no puede dejarse en blanco).
2. Haga clic en **Confirm Cancellation** para continuar — o en **Back** para volver sin cancelar.

El motivo se almacena de forma permanente en la auditoría del Historial de Estados.

---

## 9. Gestión de Carga (Parcelas)

La sección **Parcels** dentro del formulario de Detalles de la Nominación contiene las filas de carga. Cada fila representa un lote de carga.

### Edición en Línea (en el formulario de nominación)

Cada fila de parcela tiene cuatro columnas: **Product**, **Quantity**, **Unit** y **Operation**. Haga clic en **Add row** al final de la sección Parcels para agregar un nuevo lote de carga, o haga clic en la **×** roja para eliminar uno.

### Modal de Actualización de Carga

Para las cifras de carga en curso (tiempos de finalización, cantidades restantes, tasas de carga), utilice la acción **Cargo Update** en el panel derecho:

![Cargo Update modal showing Date Update / Time fields at the top, and per-parcel rows for Soja and Maíz with columns: #, Product, ETC Date, Operation, Qty On Board, Unit, Qty To Go, Unit, Loading Rate, Unit](screenshots/nominations/18_cargo_update_modal.png)

Complete los siguientes campos para cada parcela:

| Campo              | Descripción                                      |
| ------------------ | ------------------------------------------------ |
| Date Update / Time | Momento en que se registró esta actualización    |
| Date ETD / Time    | Fecha y hora estimadas de partida                |
| ETC Date           | Fecha estimada de finalización para esta parcela |
| Qty On Board       | Cantidad restante a bordo                        |
| Qty To Go          | Cantidad pendiente de descargar                  |
| Loading Rate       | Tasa operativa de carga/descarga                 |

Haga clic en **Save as Draft** para guardar sin enviar, o en **Send Message** para guardar y abrir el modal de redacción del correo de actualización de carga.

---

## 10. Respuesta a un ETA

La acción **E.T.A.** registra las fechas y horas estimadas de arribo del buque y, opcionalmente, envía un correo de ETA.

![Answer ETA modal for MV Liberian Star showing: Msg. ETA (date/time the master sent the ETA), ETA Notify (checkbox + date/time), ETPOB — Estimated Time Pilot On Board (checkbox + date/time), ETB — Estimated Time Berthing (checkbox + date/time), and Ref ETA/ETB Message field. Three action buttons at bottom: ETA Request, Send to Terminal, Reply to Master](screenshots/nominations/17_eta_modal.png)

1. En la sección **Actions** del panel derecho, haga clic en **E.T.A.**
2. Complete el registro de ETA:

| Campo                 | Descripción                                                                             |
| --------------------- | --------------------------------------------------------------------------------------- |
| Msg. ETA              | Momento en que el capitán del buque envió el mensaje de ETA                             |
| ETA Notify            | ETA informado por el capitán (marque la casilla para habilitar e ingrese la fecha/hora) |
| ETPOB                 | Hora estimada de embarque del práctico (marque para habilitar)                          |
| ETB                   | Hora estimada de atraque (marque para habilitar)                                        |
| Ref ETA / ETB Message | Nota de referencia opcional (por ejemplo, referencia del mensaje del capitán)           |

3. Haga clic en uno de los botones de envío:
   - **ETA Request** — envía un correo de solicitud de ETA al buque
   - **Send to Terminal** — envía la notificación de ETA a la terminal
   - **Reply to Master** — envía la respuesta al capitán
4. O haga clic en **Save** para guardar el registro de ETA sin enviar ningún correo y luego en **Close**.

---

## 11. Envío de Correos Electrónicos

Los botones de acción de correo aparecen en la sección **Actions** del panel derecho. Cada uno abre un modal de redacción precargado con los datos de la nominación.

![Right rail showing the Actions section with six blue link buttons: Acknowledgement, Prearrival, E.T.A., Cargo Update, Statement of Facts, NOR](screenshots/nominations/09_right_rail.png)

### Acciones Disponibles

| Botón                  | Descripción                                          |
| ---------------------- | ---------------------------------------------------- |
| **Acknowledgement**    | Carta de aceptación de la nominación a los mandantes |
| **Prearrival**         | Notificación estándar de pre-arribo                  |
| **E.T.A.**             | Registro de ETA + envío a la terminal / capitán      |
| **Cargo Update**       | Estado de la carga con cifras por parcela            |
| **Statement of Facts** | Ingreso de datos del SOF + correo electrónico        |
| **NOR**                | Nota de Disposición                                  |

### Modal de Redacción

Al hacer clic en **Acknowledgement**, **Prearrival** o **NOR** se abre el modal de redacción de correo:

![Acknowledgement of Nomination compose modal showing To/CC/BCC recipient fields with "Add from group" selector, Subject pre-filled as "Acknowledgement of Nomination — MV Liberian Star", and an HTML Body area](screenshots/nominations/16_acknowledgement_compose.png)

| Campo              | Notas                                                                            |
| ------------------ | -------------------------------------------------------------------------------- |
| **To / CC / BCC**  | Precargado con los destinatarios de correo de la nominación. Editable por envío. |
| **Add from group** | Busque un grupo de contactos y agregue sus miembros a Para, CC o CCO.            |
| **Subject**        | Completado automáticamente desde la plantilla (editable).                        |
| **Body**           | Cuerpo del correo en HTML precargado desde la plantilla Handlebars.              |

Edite cualquier campo según sea necesario y luego desplácese hacia abajo hasta **Send**.

### Flujo de Trabajo del Statement of Facts (SOF)

La acción SOF abre un modal de ingreso de datos antes de redactar el correo:

![Statement of Facts modal showing: General Info section with Last Port, Next Port, Berth (Terminal Fluvial), Captain (Capt. Igor Volkov), Mobile on Board fields. Below that a Times Sheet section with Insert/Delete buttons and a table with Date/Time/Activity/Comment columns. Bottom tab bar: Bunkers/Draft/Parcel, Bill Fig./Ship Fig., Letters/Remarks, Slop/B. Received](screenshots/nominations/19_sof_modal.png)

1. Haga clic en **Statement of Facts** en el panel derecho.
2. Complete la **Información General**: Last Port, Next Port, Berth, Captain, Mobile on Board.
3. En la pestaña **Times Sheet**, haga clic en **Insert** para agregar filas al registro de actividades (Date, Time, Activity, Comment).
4. Cambie de pestaña para completar datos adicionales:
   - **Bunkers/Draft/Parcel** — cifras de combustible y lecturas de calado (FWD/AFT)
   - **Bill Fig./Ship Fig.** — cifras del Conocimiento de Embarque y cifras reportadas por el buque
   - **Letters/Remarks** — Cartas de Protesta y observaciones del viaje
   - **Slop/B. Received** — slop descargado y combustible recibido
5. Haga clic en **Save** para guardar todos los datos (un SOF por nominación, actualizado en cada guardado).
6. Haga clic en **Send SOF Email** para abrir el modal de redacción del correo con los datos del SOF.

---

## 12. Visualización del Registro de Mensajes

La sección **Messages** en la parte inferior del panel izquierdo registra todos los correos electrónicos despachados desde esta nominación.

![Clients table at top and Messages collapsible section header at the bottom of the detail page](screenshots/nominations/08_messages_section.png)

Expanda la sección **Messages** haciendo clic en su encabezado (▼). Cada fila muestra:

| Columna | Descripción                                                        |
| ------- | ------------------------------------------------------------------ |
| Type    | Tipo de acción (por ejemplo, ACKNOWLEDGEMENT, ETA_REPLY, SOF, NOR) |
| Subject | Asunto del correo electrónico                                      |
| To / CC | Destinatarios                                                      |
| Status  | SENT / FAILED / PENDING                                            |
| Sent At | Marca de tiempo del despacho                                       |
| Sent By | Usuario que activó el envío                                        |

Haga clic en una fila para expandirla y ver el cuerpo completo del correo en HTML.

---

## 13. Auditoría del Historial de Estados

El panel **Status History** en el panel derecho muestra un registro de solo adición con cada transición de estado.

![Right rail Status History section showing a timeline with three nodes: DRAFT (martin.silva@portlog.local, Jun 10 2026), DRAFT → CONFIRMED (admin@portlog.local, Jun 10 2026), CONFIRMED → IN_PROGRESS (martin.silva@portlog.local, Jun 10 2026)](screenshots/nominations/03_nomination_detail_full.png)

Cada nodo del cronograma registra:

- **Estado anterior → Estado nuevo** (etiquetas codificadas por color)
- **Usuario** que realizó el cambio
- **Fecha y hora** de la transición (UTC)
- **Motivo** (se muestra en las transiciones a CANCELLED)

Las entradas se ordenan de más antiguas a más recientes. Este registro es permanente — no puede editarse ni eliminarse.

---

## Referencia Rápida

### Botones de Transición de Estado

| Estado Actual | Botones                    |
| ------------- | -------------------------- |
| Draft         | Confirm · Cancel           |
| Confirmed     | Start · Cancel             |
| In Progress   | Complete · Cancel          |
| Completed     | _(ninguno — solo lectura)_ |
| Cancelled     | _(ninguno — solo lectura)_ |

### Tipos de Nominación

| Etiqueta               | Significado                                   |
| ---------------------- | --------------------------------------------- |
| Full Agency            | Servicios de agencia completos                |
| Owners Agents Only     | Actuando únicamente como agentes del armador  |
| Charterers Agents Only | Actuando únicamente como agentes del fletador |

### Unidades de Parcela

`Bbls` · `M/T` · `L/T` · `C/M` · `Kg` · `Us/G`

### Operaciones de Parcela

`Load` · `Disch` · `Transit` · `STSD` · `STSL` · `Bunker`

### Tipos de Clientes Predeterminados

Head Owner · Charterer · Disponent Owner · Technical Operator · Commercial Operator · Manning Agents · Catering Agents · Time Charter · Ship Management · Broker · Hub Agents · Administrative Ag. · Inspection · Receivers
