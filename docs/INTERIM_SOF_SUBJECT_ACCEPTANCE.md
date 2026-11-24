# Interim SOF subject acceptance

Requirement `nvm-8wv` was checked on 24 November 2026 against release baseline `3b83500`. The requested `Interim Statement of Facts` suffix already exists, so this change adds acceptance coverage and records the verified behavior without changing application runtime code.

## Verified behavior

- `NominationsService.getComposeData` maps `SOF_INTERIM` to the existing SOF template and supplies the interim title. Rendering the real email template appends exactly ` - Interim Statement of Facts` to the saved nomination business-reference line. Final SOF uses its separate ` - Final Statement of Facts` title.
- The added compose cases use `FOREVER VOY. 005-26 - Calling to PDVSA PUERTO MIRANDA SN3092/26/MBO` as an explicitly saved reference. They verify its exact preservation and one appended suffix.
- Dispatch preserves an operator-supplied email subject in both the recorded dispatch and the message handed to the email adapter. It does not replace that subject with a newly composed default.
- Interim dispatch remains classified as `SOF_INTERIM`. It uses the SOF PDF renderer with `INTERIM STATEMENT OF FACTS`; final dispatch uses `FINAL STATEMENT OF FACTS`. Tests render the actual PDF Handlebars template HTML and check the title and canonical selected SOF content.
- Source inspection confirms the compose drawer initializes the subject only while the field is clean and submits the form subject on send. Interactive browser acceptance remains part of the combined release check.

## Validation

- `npm run test -w @portlog/backend -- --runInBand nominations.service.spec.ts dispatch-sof.spec.ts`: 180 tests passed across the matching suites.
- Backend TypeScript check, focused ESLint, Prettier and `git diff --check` passed.

The dispatch tests use isolated database, email, storage and PDF adapters; no external email was sent and no live data was changed. The PDF check validates renderer input and actual template HTML, not a newly rendered PDF image.

This evidence covers the interim/final suffix distinction and subject preservation. Generating a complete new base subject with the explicit vessel VOY and an agreed canonical SN/OT remains the separate `nvm-9hw` and numbering work. It does not change previously sent subjects or archived documents.
