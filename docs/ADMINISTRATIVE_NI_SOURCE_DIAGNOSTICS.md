# Administrative NI source diagnostics

The November 23 report shows a partially populated administrative NI, with vessel details present but special instructions, municipality and fiscal recipients absent. A populated synthetic record renders all seven sections correctly through the actual DOCX generator. A missing-data record reproduces the reported pattern without losing the vessel fields. No template-mapping defect was reproduced, and production data was not queried by this change.

Admins can select **Revisar datos** beside the administrative NI actions. The read-only report identifies which saved sources are populated, missing or incomplete, and names the selected instruction client. It does not modify values or prevent Word downloads.

| Blank area                        | Saved source to check                                                          |
| --------------------------------- | ------------------------------------------------------------------------------ |
| Port cost instructions            | Selected instruction client's administrative port cost instructions            |
| Owner expenses instructions       | Selected instruction client's administrative owner expenses instructions       |
| Technical management instructions | Selected instruction client's administrative technical management instructions |
| Municipality                      | Operation port's municipality                                                  |
| Port costs billed to              | Nomination's saved PORT_COSTS fiscal recipient/address snapshot                |
| Owner expenses billed to          | Nomination's saved OWNER_EXPENSES fiscal recipient/address snapshot            |
| Technical management billed to    | Nomination's saved TECHNICAL_MANAGEMENT fiscal recipient/address snapshot      |

If an instruction client is selected, its fields win even when blank. The charterer is a fallback only when no instruction client is selected. General client instructions and another client's populated administrative instructions are not substitutes. The three fiscal categories are independent: each must be selected explicitly; an ordinary directory address is not automatically a fiscal recipient.

`GET /nominations/:id/administrative-nomination-instructions/diagnostics` requires the existing ADM role and returns private/no-store status data, not instruction text or fiscal addresses. OPS download access is unchanged. The report uses the same read query and precedence as document generation. No migration is needed.

To complete the reported FOREVER record, an authorized owner must first inspect its report, confirm the intended instruction client, then supply only the missing administrative instructions, port municipality and per-category fiscal selections. No such authoritative values were supplied with the report; this change does not infer them from the sample document.

Validation covers selected-client precedence, charterer fallback, whitespace-only instructions, absent sources, incomplete billing snapshots, independent categories, populated and missing-data actual DOCX exports, unknown IDs, unauthenticated/OPS rejection, and ADM access without mutations. Browser integration verification is performed with the combined requirements changes.
