# Email-code two-factor authentication

Email 2FA is opt-in per person under **Security**. Existing accounts default to disabled; this migration does not enroll or lock out any production user. The account's existing email is the only destination. No request can choose a recipient.

## Enrollment and sign-in

1. Sign in, open Security, enter the current password and request enrollment.
2. Confirm the six-digit email code. Only then is 2FA enabled. Existing access and refresh sessions become invalid; sign in again.
3. Future sign-ins validate the password before sending a code. Neither access nor refresh credentials are issued until code verification succeeds.
4. Disabling requires a fresh password check and a separate purpose-bound email code. A sign-in or enrollment code cannot authorize disabling. This also invalidates existing sessions.

Codes expire after ten minutes and allow five incorrect attempts. They are single-use, including concurrent verification. Reissuing invalidates earlier codes for the same purpose. Database-backed per-account limits allow one send per minute and five sends per fifteen minutes across application instances; public endpoints also have IP limits. To request a replacement code, select **Start again** and sign in again. Codes and challenge identifiers are redacted from request logs. Stored codes are HMAC digests bound to the challenge and server secret, not plaintext. Challenges also bind to the current password and authentication version. Failed delivery never enables 2FA or creates a login session. Old challenge rows are pruned after seven days during issuance.

Password resets preserve enrollment and invalidate outstanding challenges. Account deactivation prevents verification. Other users, including administrators, cannot toggle another account's factor through a public administration endpoint.

## Recovery and deployment boundary

There is deliberately no password-only recovery or unprotected administrator disable endpoint. If the person loses email access, an authorized operator must verify their identity and restore access to the existing mailbox through its provider. Password reset alone does not remove the email challenge. A different recovery method or mailbox-change workflow requires a separately reviewed change; never recover a person's account by handing them a shared login.

Email codes depend on the existing SMTP transport. Do not enroll real users until delivery to their account email has been verified. Outgoing delivery infrastructure remains a separate blocked rollout item; this PR neither configures a provider nor sends real test mail. Tests use isolated PostgreSQL and synthetic captured messages.

A shared branch mailbox does not identify the individual who reads a code. It is weaker than a personally controlled second factor; the Security page explains this before enrollment. This feature does not resolve username-only PLC provisioning or branch-specific operational senders. Email codes are not phishing-resistant. These limitations are consistent with the [OWASP MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html).

## Validation

Run the regular workspace checks. The PostgreSQL/HTTP suite is opt-in and never falls back to the application's database:

```sh
TEST_TWO_FACTOR_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/ISOLATED_TEST_DB \
  npm run test -w @portlog/backend -- --runInBand email-two-factor.integration.spec.ts
```

Apply migrations to a disposable database first. The suite resets only its two `example.test` fixture users; use a dedicated test database. It verifies enrollment, login, disable, session invalidation, concurrency, replay, expiry, attempt/send limits, purpose and account binding, password reset, account deactivation, recipient validation and delivery failure.
