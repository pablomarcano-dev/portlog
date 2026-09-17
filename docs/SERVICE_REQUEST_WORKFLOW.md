# Vessel service requests

New requests belong to a registered vessel. Start from the vessel's **Service requests** section (Vessels for an IMO-linked registered vessel, or Master Data → Ship Particulars), choose **Request service**, and select launch, tug, underwater inspection, ballast, STS, or transport/other services. The main Service Requests screen also permits creation with a required vessel picker. The SN/OT port-call link is optional; when supplied, it must belong to the selected vessel and the user's assigned branch.

The branch is assigned by the backend from the signed-in user. The existing database-wide auto-increment remains the national service order sequence; each displayed control number also carries the year and branch code. It is independent of nomination numbering. Existing historical records are not renumbered.

## Authority requests and purchase orders

Mark **Requested by an authority** and enter the entity (for example INEA) when applicable. Save the draft and upload its supporting document in Documents. Both PDF generation and sending require a supplier, and authority requests additionally require the authority name and at least one linked document. An explicit ordinary request does not require an authority letter. Legacy rows with no explicit authority answer retain the former service-type requirement until reviewed.

The operator generates/sends the purchase order from the saved request. The email includes the PDF and supporting documents. The PDF and default email ask the provider to accompany their invoice with the order and quote its control number. No automatic external email is sent on supplier selection.

The Service step collects a departure or delivery point, destination, contact person, and an optional maneuver description. The Word order uses one service item with the service quantity; technical details appear in Observations. A branch manager for the request branch or an administrator may record approval on a saved draft. The approver name and date then appear on the Word form, while signature spaces remain for actual signatures. Saving further draft changes clears approval.

**Download Word order** renders current values while the request is a draft. Sending archives a Word copy alongside the emailed PDF. Later downloads return the archived copy, and dispatch history offers the exact PDF and Word for each send. Older issued orders without a Word archive retain their issued PDF and do not generate a potentially misleading Word reconstruction.

After issue, **Invoice and service reconciliation** records the supplier invoice number, physical voucher, actual cost, and internal reconciliation notes. The provider instructions on the order are locked. **Provider receipt** records recipient name, role, date, and an optional signed scan; a scan can be added later, while recorded receipt facts cannot be rewritten. Completion uses the existing **Mark as completed** action. Amounts retain the order's currency.

## Reporting

Service Requests contains a national service register with branch, vessel, provider, type, status, and date filters. The consumption panel groups by provider, service, and currency, either nationally or by branch. It displays request counts, completed counts, recorded actual costs, and the count of requests missing actual costs. Cancelled requests are excluded from cost groups and shown separately in the overall counts. Drafts are included in request counts, not presented as completed work.

**Export service register** exports all matching records, not only the visible page, including the control number, vessel, branch, supplier, service, status, schedule, actual cost, currency, voucher, and invoice reference. Date-only end filters include the full final UTC date.

## Deployment

Migration `20260908190000_vessel_service_authority` adds nullable authority-request metadata and the supplier invoice reference. No existing records or sequence values are changed. Deploy schema, backend, and frontend together.

Migration `20260917120000_service_request_operational_order` adds nullable operational order, approval, receipt, and archive fields. Existing launch departure points remain available as a fallback. Existing issued orders have no archived Word copy; their issued PDF remains available. Deploy the migration before the updated backend and frontend.

## Validation

Verified on an isolated local database with JSON email capture: vessel service without nomination; generated and captured purchase order; authority document requirement and attachment send; transport PDF; invoice/cost reconciliation and completion; vessel/branch report filters. Browser checks cover vessel profile → service request, creation without SN/OT, report display and CSV export. Live SMTP delivery was not tested.
