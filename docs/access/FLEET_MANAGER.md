# Fleet Manager access policy

Fleet Manager uses the explicitly assigned **FLT** access role. Fleet Manager and Senior Fleet Manager are operational positions, not privilege grants. Creating or editing a person must deliberately assign FLT; no migration promotes existing users based on a title or email address.

The November 24 revised answers confirm full voyage editing, voyage creation, Clients/billing, base Master Data, history and national branch visibility. The owner authorized best-effort decisions for remaining Fleet Manager permissions on November 26.

| Capability                                                           | Fleet Manager (FLT)                            | Policy basis                                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| See all national branches and switch selected context                | Allowed                                        | José's revised answers                                                                    |
| Create voyages and edit all voyage details                           | Allowed                                        | José's revised answers                                                                    |
| Manage Clients, nomination billing and base Master Data              | Allowed                                        | José's revised answers                                                                    |
| View operational history and Changelog                               | Allowed                                        | José's revised answers                                                                    |
| Use operational documents, SOF and dispatch workflows                | Allowed within existing workflow rules         | Operational management default                                                            |
| Edit PEDR operational requirements                                   | Allowed                                        | Best-effort: these are operational voyage data, not user administration                   |
| Inspect missing NI administrative source fields                      | Allowed, read-only                             | Best-effort: managers already manage the underlying Clients/billing data                  |
| Cancel nominations                                                   | Admin only                                     | Explicit prior restriction                                                                |
| Delete SH documents                                                  | Admin only                                     | Conservative default for destructive document actions                                     |
| Manage users, access roles, password resets or other users' security | Admin only; no cross-user 2FA bypass           | Conservative administrative boundary                                                      |
| Owner financial agreements and protected financial history           | Requires explicit `owner.financial` permission | Existing independent permission; FLT does not imply it                                    |
| Approve service requests                                             | Existing branch-manager or Admin rule          | Approval authority is separate from national visibility; no extra approval grant inferred |

Shipping agents remain branch-scoped and their voyage-detail edits remain limited to Last Port, Next Port and Boarding. Their operational lookup access is retained; full Clients and management writes are denied.

This policy completes capability decisions. Real-person role/branch assignments and operational positions remain separate rollout work. No production accounts are promoted, reclassified or otherwise changed by this PR. The two clarified operational endpoints are covered by HTTP authorization tests alongside Admin-only and independent financial-permission boundaries.
