# Portlog — Master Data User Manual

Master Data is the reference layer that everything else in Portlog depends on. Vessels, ports, owners, operators, branches, and email groups are all defined here. Get these right and the rest of the system flows naturally.

---

## Table of Contents

1. [Navigating Master Data](#1-navigating-master-data)
2. [Common Interface Pattern](#2-common-interface-pattern)
3. [Ship Particulars (Vessels)](#3-ship-particulars-vessels)
4. [Ports](#4-ports)
5. [Branches](#5-branches)
6. [Owners](#6-owners)
7. [Operators](#7-operators)
8. [Clients](#8-clients)
9. [Contacts](#9-contacts)
10. [Email Groups](#10-email-groups)
11. [Flags](#11-flags)
12. [Activities](#12-activities)
13. [Cargoes](#13-cargoes)
14. [Agents](#14-agents)
15. [Charterers](#15-charterers)
16. [Shippers](#16-shippers)
17. [Suppliers](#17-suppliers)
18. [Permissions Summary](#18-permissions-summary)

---

## 1. Navigating Master Data

Click **Master Data** in the top navigation bar to open the module. A second tab bar appears below the main nav with all 14 entity types.

![Master Data tab bar showing: Ship Particulars, Owners, Flags, Activities, Cargoes, Ports, Charterers, Shippers, Agents, Operators, Contacts, Suppliers, Clients, Branches, Email Groups](screenshots/master-data/00_master_data_overview.png)

Click any tab to open that entity. The page redirects to an empty form ready for a new record, or click a name in the left list to load an existing record.

---

## 2. Common Interface Pattern

Almost every entity in Master Data uses the same two-panel layout.

**Left panel — list**

- All records sorted alphabetically by name
- **FLASH SEARCH** input at the top — type to filter the list instantly
- Click any name to load it into the right panel

**Right panel — form + button bar**

The button bar at the top of the right panel is the same on every entity:

| Button     | Action                                |
| ---------- | ------------------------------------- |
| **Print**  | Print the current record              |
| **Prior**  | Load the previous record in the list  |
| **Next**   | Load the next record in the list      |
| **First**  | Jump to the first record              |
| **Last**   | Jump to the last record               |
| **New**    | Clear the form to create a new record |
| **Cancel** | Discard unsaved changes               |
| **Accept** | Save the current record               |

> **Required fields** are marked with a red asterisk `*`. The **Accept** button stays disabled until all required fields are filled.

---

## 3. Ship Particulars (Vessels)

The vessel registry. Every nomination references a Ship Particular, so this is where you start when a new vessel needs to be added.

![Ship Particulars — MV Liberian Star selected, showing the vessel list on the left and the form on the right with all fields filled: Name (MV Liberian Star), Abbreviation (LBSTAR), Call Sign (LBST), IMO Number (9456789), Refresh from Datalastic button, Flag (Liberia), Owner (Liberian Star Holdings LLC), Operator (Sudatlantic Shipping S.A.), LOA 176m, DWT 28000, GRT 17000, NRT 8500](screenshots/master-data/sp_selected.png)

### Fields

| Field                     | Required | Notes                                              |
| ------------------------- | -------- | -------------------------------------------------- |
| **Name**                  | Yes      | Full vessel name (e.g., MV Liberian Star)          |
| **Abbreviation**          | No       | Short ID (e.g., LBSTAR)                            |
| **Call Sign**             | No       | Uppercase alphanumeric, 3–15 chars; must be unique |
| **IMO Number**            | No       | Exactly 7 digits; must be unique                   |
| **Flag**                  | Yes      | Select from the Flags list                         |
| **Owner**                 | No       | Select from the Owners list                        |
| **Operator**              | No       | Select from the Operators list                     |
| **LOA (m)**               | No       | Length Overall in metres                           |
| **DWT**                   | No       | Deadweight Tonnage                                 |
| **GRT**                   | No       | Gross Register Tonnage                             |
| **NRT**                   | No       | Net Register Tonnage                               |
| **Email**                 | No       | Vessel email address                               |
| **Phone / Phone 2 / Fax** | No       | Contact numbers                                    |
| **Comments**              | No       | Internal notes                                     |

### Refresh from Datalastic (AIS Lookup)

When a valid 7-digit IMO is entered and differs from the saved value, a **Refresh from Datalastic** button appears. Click it to fetch the latest vessel data from the AIS provider — name, call sign, dimensions, and flag auto-populate from the result. Review the values and click **Accept** to save.

### Adding a New Vessel

1. Click the **Ship Particulars** tab.
2. Click **New** in the button bar.
3. Enter Name and select Flag (required).
4. Add the IMO number if available — this enables the Datalastic refresh.
5. Link Owner and Operator if known.
6. Click **Accept**.

---

## 4. Ports

Port facilities where vessels call. Each port can have multiple **Piers** (berths/terminals).

![Ports — Nueva Palmira selected, showing: Name (Nueva Palmira), Acronym (NPA), Country (Uruguay), Email Group (npa-ops), Comentarios field, and the Piers section with three piers: Muelle Fiscal, Muelle Principal, Terminal Fluvial each with an × delete button, and a "New pier name..." input with + button](screenshots/master-data/ports_selected.png)

### Fields

| Field           | Required | Notes                                               |
| --------------- | -------- | --------------------------------------------------- |
| **Name**        | Yes      | Full port name                                      |
| **Acronym**     | No       | Short code used throughout the app (e.g., NPA, MVD) |
| **Country**     | No       | Country or region                                   |
| **Email Group** | No       | Default email group for port authority recipients   |
| **Comentarios** | No       | Internal notes                                      |

### Managing Piers

Below the port fields, the **Piers** section lists all berths/terminals for this port:

- **Add a pier** — type a name in the "New pier name…" input and click **+** (or press Enter)
- **Remove a pier** — click the red **×** next to its name
- Changes to piers are saved atomically when you click **Accept**

### Adding a New Port

1. Click the **Ports** tab.
2. Click **New**.
3. Enter Name (required) and Acronym.
4. Add Country and Email Group if known.
5. Add piers as needed.
6. Click **Accept**.

---

## 5. Branches

Company branch/office locations. The Branch determines which branch documents are available in a nomination and which templates the agency uses.

![Branches — list on the left showing BBL — Bahía Blanca, BUE — Buenos Aires, COL — Colonia, FBT — Fray Bentos, JSE — José Ignacio, LGR — La Guaira Branch Office, PLC — La Paloma, MVD — Montevideo, NPA — Nueva Palmira, PYS — Paysandú, ROS — Rosario. Right panel shows empty form with Name, Code, Comments, Comentarios fields](screenshots/master-data/branches_selected.png)

### Fields

| Field        | Required | Notes                                                        |
| ------------ | -------- | ------------------------------------------------------------ |
| **Name**     | Yes      | Full branch name (e.g., Nueva Palmira Branch)                |
| **Code**     | Yes      | Unique short code (e.g., NPA); used in nomination references |
| **Comments** | No       | Internal notes                                               |

The list shows each branch as **CODE — Name** for easy identification at a glance.

### Adding a New Branch

1. Click the **Branches** tab.
2. Click **New**.
3. Enter Name and Code (both required). The code must be unique.
4. Click **Accept**.

---

## 6. Owners

Vessel owners. Includes CRM fields for relationship management and permission-gated financial data.

![Owners — Liberian Star Holdings LLC selected, showing the full owner list on the left and the form with: Name (Liberian Star Holdings LLC), Physical Address (80 Broad St, Monrovia, Liberia), Address (correspondence), Phones (+231 77 101 234), Contact Number, Contact List, Birthday, Preferences, Recommendations, Business fields](screenshots/master-data/owners_selected.png)

### Fields

**Contact block**

| Field                        | Notes                              |
| ---------------------------- | ---------------------------------- |
| **Name**                     | Owner company name (required)      |
| **Physical Address**         | Actual office address              |
| **Address (correspondence)** | Mailing address if different       |
| **Phones**                   | Phone numbers (free text)          |
| **Contact Number**           | Primary contact number             |
| **Contact List**             | Name of the contact person or list |

**CRM block** (scroll down to see)

| Field               | Notes                              |
| ------------------- | ---------------------------------- |
| **Birthday**        | Contact's birthday (free text)     |
| **Preferences**     | Personal preferences and interests |
| **Recommendations** | Notes on recommended handling      |
| **Business**        | Business background and notes      |
| **Webpage**         | Owner's website URL                |

**Financial block** (visible only with `owner.financial` permission)

| Field          | Notes                                                          |
| -------------- | -------------------------------------------------------------- |
| **Agreements** | Financial agreement terms                                      |
| **History**    | JSON tracking vessel history, open tickets, invoices, payments |

Users without `owner.financial` permission see a yellow alert box instead of these two fields.

---

## 7. Operators

Vessel operators — companies managing day-to-day vessel operations.

![Operators — full list on the left (Armadores del Río S.A., Delta Marine Operators, Granos del Sur S.A., etc.) and the form with: Name, Email, Business Phone, Business Fax, Address, Standard Requirements textarea, Send Copy checkbox, Location dropdown, Items Proforma button (disabled), Contacts section](screenshots/master-data/operators_selected.png)

### Fields

| Field                     | Notes                                                                      |
| ------------------------- | -------------------------------------------------------------------------- |
| **Name**                  | Operator company name (required)                                           |
| **Email**                 | Primary contact email                                                      |
| **Business Phone / Fax**  | Contact numbers                                                            |
| **Address**               | Full mailing address                                                       |
| **Standard Requirements** | Required documentation or compliance notes for this operator               |
| **Send Copy**             | If checked, this operator is automatically CC'd on outbound documents      |
| **Location**              | **L** (Local) or **E** (Exterior) — indicates local vs. international base |
| **Comments**              | Internal notes                                                             |

---

## 8. Clients

Port agency clients — companies for which the branch provides services. Includes multiple address types and an inline tariff table.

![Clients — empty list ("No records found") on the left and the full Clients form showing: Name, Tel., Tel. 2, Physical Address, Billing Address (+ Copy Physical button), Postal Address (+ Copy Physical), Tax Address (+ Copy Physical), Other Address (+ Copy Physical), Fax, Mobile, EMail, EMail Group, Client Tariff table with # / Item / Amount / Information columns and "Insert new row" button, Instructions textarea](screenshots/master-data/clients_selected.png)

### Fields

**Basic info**

| Field             | Notes                          |
| ----------------- | ------------------------------ |
| **Name**          | Client company name (required) |
| **Tel. / Tel. 2** | Primary and secondary phone    |

**Addresses** — each has a **Copy Physical** button to duplicate the physical address:

- Physical Address
- Billing Address
- Postal Address
- Tax Address
- Other Address

**Contact**

| Field           | Notes                                             |
| --------------- | ------------------------------------------------- |
| **Fax**         | Fax number                                        |
| **Mobile**      | Mobile phone                                      |
| **EMail**       | Primary email                                     |
| **EMail Group** | Reference to an email group for bulk distribution |

**Client Tariff table**

An inline editable table for client-specific pricing:

| Column          | Notes                   |
| --------------- | ----------------------- |
| **#**           | Auto-numbered row       |
| **Item**        | Service or product name |
| **Amount**      | Price or cost           |
| **Information** | Additional notes        |

Click **Insert new row** to add a tariff line. Click the **×** icon on a row to remove it. All changes are saved with the client when you click **Accept**.

**Instructions** — special handling or service notes for this client.

---

## 9. Contacts

Individual contacts directory. Each contact can be linked to one organization (Shipper, Operator, Owner, or Charterer).

![Contacts — list on the left (Ana Rodríguez, Andrea Vieira, Carlos Fernández, Gonzalo Ferreiro, Jean-Paul Martin, Lars Eriksen, María José Suárez, Pablo Giménez, Roberto Herrera, Stavros Papadopoulos) and form with: Name, Email, Home Phone, Mobile, Business Phone, Business Fax, Address, "Link to" segmented control (Shipper / Operator / Owner / Charterer / None), Comments, Comentarios](screenshots/master-data/contacts_selected.png)

### Fields

| Field              | Notes                            |
| ------------------ | -------------------------------- |
| **Name**           | Contact person's name (required) |
| **Email**          | Email address                    |
| **Home Phone**     | Home phone                       |
| **Mobile**         | Mobile number                    |
| **Business Phone** | Business phone                   |
| **Business Fax**   | Business fax                     |
| **Address**        | Full mailing address             |
| **Comments**       | Internal notes                   |

### Linking to an Organization

The **Link to** segmented control at the bottom determines which company this contact is associated with:

| Option        | Effect                                              |
| ------------- | --------------------------------------------------- |
| **Shipper**   | Shows a Shipper picker — select the shipper company |
| **Operator**  | Shows an Operator picker                            |
| **Owner**     | Shows an Owner picker                               |
| **Charterer** | Shows a Charterer picker                            |
| **None**      | Contact is unlinked (default)                       |

> Only one organization can be selected per contact. Switching category clears the previous selection.

---

## 10. Email Groups

Distribution lists used as recipient groups throughout document dispatch. Groups can be assigned to ports and clients, and selected as recipients when composing emails.

![Email Groups — list on the left (Aduana y Frontera, Autoridades Portuarias, Capitanes de Puerto, Control e Inspección, Equipo Agencia, Fletadores Graneles, Operador / Armador, Proveedores Bunker, Prácticos y Remolcadores, Salud y Sanidad) and form with: Name, Description, Members section with "Paste emails (semicolons)" field and "+ Add row" button, Comentarios](screenshots/master-data/emailgroups_selected.png)

### Fields

| Field           | Notes                                    |
| --------------- | ---------------------------------------- |
| **Name**        | Group name (required)                    |
| **Description** | Brief description of the group's purpose |
| **Comments**    | Internal notes                           |

### Managing Members

**Bulk paste** — paste semicolon-separated email addresses into the "Paste emails (semicolons)" field. Invalid addresses are skipped.

**Manual add** — click **+ Add row** to insert a blank row, then fill in:

- **Email** — valid email address (required per row)
- **Display Name** — optional friendly label shown in recipient lists

Click the **×** on a row to remove a member. Click **Accept** to save all changes.

---

## 11. Flags

Country flag codes for vessel registration.

### Fields

| Field            | Notes                                              |
| ---------------- | -------------------------------------------------- |
| **Name**         | Country name (required, e.g., "Panama", "Liberia") |
| **Abbreviation** | ISO code or custom code (e.g., "PA")               |
| **Comments**     | Internal notes                                     |

---

## 12. Activities

Activity types used in the SOF (Statement of Facts) timesheet. When building a SOF, every timesheet row references one of these activity codes.

### Fields

| Field        | Notes                                                         |
| ------------ | ------------------------------------------------------------- |
| **Name**     | Activity type name (required, e.g., "Loading", "Discharging") |
| **Comments** | Internal notes                                                |

---

## 13. Cargoes

Catalog of cargo types.

### Fields

| Field        | Notes                                                              |
| ------------ | ------------------------------------------------------------------ |
| **Name**     | Cargo name (required, e.g., "Soja", "Maíz")                        |
| **BBL Unit** | Unit of measurement: **BBL**, **MT**, **KG**, or **LT** (required) |
| **Comments** | Internal notes                                                     |

---

## 14. Agents

Port agents and maritime service providers.

### Fields

| Field            | Notes                                        |
| ---------------- | -------------------------------------------- |
| **Name**         | Agent company name (required)                |
| **Address**      | Full mailing address                         |
| **Contact Info** | Email, phone, fax, and other contact details |
| **Comments**     | Internal notes                               |

---

## 15. Charterers

Vessel charterers — companies that hire vessels.

### Fields

| Field            | Notes                                        |
| ---------------- | -------------------------------------------- |
| **Name**         | Charterer company name (required)            |
| **Address**      | Full mailing address                         |
| **Contact Info** | Email, phone, fax, and other contact details |
| **Comments**     | Internal notes                               |

---

## 16. Shippers

Companies shipping cargo via vessel.

### Fields

| Field              | Notes                           |
| ------------------ | ------------------------------- |
| **Name**           | Shipper company name (required) |
| **Email**          | Primary email                   |
| **Business Phone** | Main phone                      |
| **Business Fax**   | Fax number                      |
| **Address**        | Full mailing address            |
| **Comments**       | Internal notes                  |

---

## 17. Suppliers

Service providers and contractors (Proveedores).

### Fields

| Field                | Notes                                            |
| -------------------- | ------------------------------------------------ |
| **Name**             | Supplier company name (required)                 |
| **Address**          | Full mailing address                             |
| **Services**         | Description of services provided                 |
| **KYC**              | Know-Your-Customer compliance notes              |
| **Phones / Emails**  | Contact information                              |
| **Certificates**     | Certification and compliance document references |
| **Rates**            | Rate schedules and pricing                       |
| **Service Contract** | Contract terms and references                    |
| **Agreements**       | Side agreements and MOUs                         |
| **Contacts**         | Key contact persons                              |
| **Comments**         | Internal notes                                   |

---

## 18. Permissions Summary

| Action                 | OPS | ADM  |
| ---------------------- | --- | ---- |
| View list              | ✓   | ✓    |
| Search                 | ✓   | ✓    |
| View record detail     | ✓   | ✓    |
| Create new record      | ✓   | ✓    |
| Edit record            | ✓   | ✓    |
| Delete record          | —   | ✓    |
| Owner financial fields | —   | ✓ \* |
| Email Group write      | ✓   | ✓    |

\* The `owner.financial` permission is a fine-grained permission separate from role. ADM users have it by default; it can be granted to OPS users individually if required.

---

## Common Tasks

### Find a record quickly

Type part of the name into the **FLASH SEARCH** box in the left panel. The list filters instantly. Click the matching record to load it.

### Create a new record

1. Click the entity tab.
2. Click **New** in the button bar.
3. Fill in required fields (marked `*`).
4. Click **Accept**.

### Edit an existing record

1. Select the record from the list.
2. Modify fields in the right panel.
3. Click **Accept** to save.

### Cancel unsaved changes

Click **Cancel** in the button bar. All changes since the last save are discarded.

### Navigate records without the list

Use **Prior** / **Next** to step through records one by one, or **First** / **Last** to jump to the ends of the list.

### Add a pier to a port

1. Select a port.
2. Scroll down to the **Piers** section.
3. Type a pier name in the "New pier name…" input.
4. Click **+** or press Enter.
5. Click **Accept**.

### Build an email group

1. Open **Email Groups**.
2. Click **New**, enter a Name.
3. Paste semicolon-separated emails into the paste field — or click **+ Add row** to add members one by one.
4. Click **Accept**.
