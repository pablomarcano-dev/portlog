# Public nominations API

The read-only public API exposes a deliberately limited view of nominations. It does not return
email recipients, employee identities, internal master-data IDs, or status-history details.

## Authentication and key rotation

Generate a secret key and its SHA-256 hash:

```sh
API_KEY="pl_live_$(openssl rand -hex 32)"
printf '%s' "$API_KEY" | shasum -a 256
```

Give the secret key to the API consumer once. Store only its 64-character hash in
`PUBLIC_API_KEY_HASHES`. Never commit either value.

To rotate without downtime:

1. Generate a new key.
2. Deploy with both hashes: `PUBLIC_API_KEY_HASHES=<old-hash>,<new-hash>`.
3. Move consumers to the new key.
4. Deploy again with only the new hash.

Requests authenticate with:

```http
Authorization: Bearer pl_live_<secret>
```

An unset or empty `PUBLIC_API_KEY_HASHES` disables access: every key is rejected.

## Endpoints

```http
GET /api/public/v1/nominations/:id
GET /api/public/v1/nominations?page=1&pageSize=25&sort=-updatedAt&status=IN_PORT
```

`pageSize` defaults to 25 and is limited to 100. `status` may be `NOMINATED`, `IN_PORT`,
`FULL_AWAY`, or `CANCELLED`.

Supported sort values are `nominatedAt`, `eta`, `createdAt`, and `updatedAt`. Prefix a field with
`-` for descending order. The default is `-updatedAt`; the nomination ID is always used as a
secondary sort to make pagination deterministic.

All persisted timestamps are returned as ISO 8601 UTC strings. Cargo
`estimatedCompletionAt` is intentionally timezone-less because Portlog stores that value as a
port-local civil date and time.
