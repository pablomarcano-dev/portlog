# Audit Module

## Purpose

The audit module provides an append-only event log (`audit_logs` table) for security-relevant
events in Portlog. It supports legal and compliance requirements for the platform.

## Immutability Constraint

**AuditLog records are append-only. No update or delete operations are permitted.**

This is a hard compliance requirement — audit logs exist to provide a tamper-evident record
of security events. The `AuditService` exposes only a `record()` method. There is no
`update()`, `delete()`, or `deleteMany()` method, and none should ever be added.

If a record must be "corrected", a new compensating record should be appended instead.

## PII Rules

- **Email** may be stored in audit records (it identifies who attempted an action).
- **Passwords are never written to audit records** — not even a partial or hashed form.
- **Password hashes are never written** — only the email field is used to identify a user
  during a failed login attempt.
- `userId` is stored when known (i.e., after a successful lookup). For `LOGIN_FAILURE`,
  `userId` is omitted because the user's existence must not be revealed.
- `metadata` is a nullable JSON field for extensibility. Any caller populating `metadata`
  must ensure no passwords, tokens, or sensitive hashes are included.

## Failure Behaviour

If an audit write fails, `AuditService.record()` logs the error at `error` level via the
NestJS Logger but does **not** re-throw. Auth operations must remain available even when
audit storage is degraded. The log message is `'audit.record failed — audit drop'`.

## Events

| Event                 | When                                                          |
| --------------------- | ------------------------------------------------------------- |
| `LOGIN_SUCCESS`       | User authenticated successfully                               |
| `LOGIN_FAILURE`       | Login attempt failed (wrong credentials or inactive account)  |
| `LOGOUT`              | User explicitly logged out                                    |
| `REFRESH_TOKEN_REUSE` | A revoked refresh token was presented (session hijack signal) |

## Timestamp

`createdAt` uses `@db.Timestamptz` (timestamp with time zone) — required for all
time-sensitive audit records on this platform. See Golden Rule in `docs/STACK.md`.
