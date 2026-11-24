# Nomination notice subjects

New automatic subject defaults use one shared formatter:

`[REFERENCE] [VESSEL] VOY. [VESSEL VOY or TBC] - CALLING TO [TERMINAL] [RESOLVED BUSINESS REFERENCE]`

The real vessel voyage is `vesselVoyageNumber`; the legacy `voyageNumber` and database correlative are never used as a vessel VOY. Blank charter reference is omitted. An explicit saved agency reference takes precedence; otherwise the existing notice-reference resolver is retained. The formatter accepts the resolved reference verbatim and does not allocate, renumber or choose a new SN/OT format.

The create form previews this wording but does not invent a correlative before database creation. An unchanged automatic preview is submitted without a manual subject override, allowing later compose to include the assigned reference. Operator-edited subjects remain overrides. Existing saved subjects, sent messages and archived documents are not rewritten; Generate remains an explicit action in edit mode.

The canonical SN/OT year width, separators, sequence scope and legacy handover remain product/data decisions under `nvm-qa6`. This change completes the independent wording and shared-default portion of `nvm-9hw`, not those numbering decisions.
