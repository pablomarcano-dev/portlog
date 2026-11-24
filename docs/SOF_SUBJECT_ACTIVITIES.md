# SOF activity email subjects

In the SOF send dialog, **Subject type** offers the existing interim/final statement subject or a **Specific activity update**. Activity mode uses `[base subject] :: [activity label]`. Operators can edit the base subject and choose another allowed activity. A selection is required before sending an activity update.

The application suggests a label only when the latest saved SOF timestamp maps to one active label. Matching ignores punctuation/case and supports explicit aliases. If the latest activity is unknown, unnamed, matches multiple labels, or simultaneous latest events disagree, the operator must choose. The application does not use an older matching event as a fallback, modify event times, or infer a new vessel status.

Administrators use **Manage activity labels** in the same dialog to add, rename or deactivate labels and configure matching saved activity names. This catalog is independent of operational Activity records. Deactivated labels cannot be selected for new sends. Previous dispatch subjects remain stored text and never change when a catalog label is edited. A label edited between composition and sending is rejected for reselection rather than silently changing the email.

The initial migration contains the 16 requested labels. Apply the additive `20261124140000_sof_subject_activities` migration through the normal reviewed migration rollout before enabling the new UI. No existing SOF, activity, nomination or dispatch rows are altered by this migration.

Authenticated routes:

- `GET /nominations/:id/sof-subject-activities`: active choices and the latest-event suggestion.
- `GET /admin/sof-subject-activities`: full catalog, ADM only.
- `POST /admin/sof-subject-activities`: validated creation, ADM only.
- `PATCH /admin/sof-subject-activities/:id`: validated update/deactivation, ADM only. No hard-delete route.

Document dispatch accepts optional `sofSubjectActivityId` only for SOF/SOF_INTERIM. The backend validates that the label is still active and uses the catalog value for the stored and delivered suffix. Legacy callers without an activity selection keep their existing statement subjects. This work does not change the business SN format, authentication roles, branch visibility or status/timestamp subject variants.
