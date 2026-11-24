# Nomination instruction previews

Nomination Actions offers a PDF preview modal alongside the existing Word download for both operational (`SNCA-RG-AGN-001`) and administrative (`SNCA-RG-AGN-002`) instructions. The preview converts the same populated DOCX produced by the existing generator; it does not reconstruct the document from a second HTML template. Opening or closing the preview does not save or discard the nomination form.

## Runtime

The backend image installs `libreoffice-writer`, `font-liberation`, `font-liberation-sans-narrow` and `font-carlito` from the Alpine repositories. Writer and the font substitutes keep conversion local to the server. No customer document is uploaded to an external viewer or conversion service.

For development outside the image, set `SOFFICE_EXECUTABLE_PATH` to the local LibreOffice executable. Its default is `/usr/bin/soffice`. `DOCX_PREVIEW_TIMEOUT_MS` optionally shortens the conversion deadline; supported values are 1000–45000 ms, with a 45000 ms default.

The application allows at most two concurrent conversions per backend process and returns `503` when occupied. Each conversion has a unique temporary directory and LibreOffice profile. Input DOCX files are limited to 10 MiB, output PDF files to 25 MiB, and process output to 1 MiB. On Unix, a detached process group is killed on timeout, application shutdown or output overflow, including LibreOffice launcher descendants. The slot is released after the process closes; temporary files are then removed. The production image runs this process as the existing non-root application user.

If conversion is unavailable, the modal explains that preview failed and offers retry. Word downloads continue to work independently. Missing optional client/port/billing data remains blank exactly as in the original generator; preview does not invent it.

## HTTP and UI

The existing authentication and OPS/ADM access policy also applies to:

- `GET /api/nominations/:id/nomination-instructions.pdf`
- `GET /api/nominations/:id/administrative-nomination-instructions.pdf`

Both return `application/pdf`, an inline content disposition, `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`. The frontend fetches bytes with the authenticated API client and lazily loads a PDF.js canvas viewer with a same-origin bundled worker. It does not require a browser PDF plugin or put a token in a frame URL. Each modal open obtains a current preview; closing or unmounting destroys the PDF document and cancels its page rendering. The viewer offers Previous/Next page controls. Pending nomination/client/billing saves disable preview until the saved data is available.

## Verification

Focused HTTP tests cover authentication, UUID validation, cache/type headers, and passing the exact generated DOCX bytes to conversion. Converter tests run real child-process fixtures to cover conversion input, invalid/missing output, process failure, concurrency limits, unique temporary directories, cleanup, and killing a timed-out launcher plus descendant.

Real local LibreOffice conversion was checked with populated copies of both retained templates, including every resulting page. The initial conversion was compared with the packaged document renderer. The operational header logo is now inline in its original merged cell, matching the existing administrative layout, so it no longer floats across the title strip. SGC codes, wording and embedded artwork bytes are retained; both preview and Word downloads use the corrected template. Browser checks verified readable administrative and operational previews, two-page navigation, retry after a failed request and retaining draft notes when closing the modal. A production-image render comparison remains a release check because the local Docker daemon was unavailable during implementation. The frontend production build verifies that the PDF.js viewer and worker are separately emitted lazy assets.

Packaging references: [Alpine Writer package](https://pkgs.alpinelinux.org/package/v3.23/community/x86_64/libreoffice-writer), [Liberation fonts](https://pkgs.alpinelinux.org/package/v3.23/main/x86/font-liberation), and [Arial Narrow-compatible font package](https://pkgs.alpinelinux.org/package/v3.23/main/aarch64/font-liberation-sans-narrow).
