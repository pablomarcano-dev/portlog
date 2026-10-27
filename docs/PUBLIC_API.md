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

## Sailing date (27 October 2026)

Both endpoints expose the sailing timestamp from the SOF activity **Sailed Full Away**:
`data[].sailedAt` in the list and `data.dates.sailedAt` in the detail. The value is an
ISO 8601 UTC timestamp (for example, `2026-10-27T19:43:00.000Z`), or `null` when no
matching activity exists, including when no SOF has been created. Activity names
are matched case-insensitively. If repeated, the last matching row in SOF display
order wins (ties use latest occurrence time, then descending row ID). Later
activities of other types do not replace the sailing date. This timestamp comes
from the activity's `occurredAt`, independently of the calculated nomination status
or estimated laycan dates. No database migration is required.

### Request and response examples

The following examples use fictitious data and show **response excerpts**; other
fields in the public contract are omitted for readability. Replace the host, API
key and nomination UUID with your integration values.

List request:

```http
GET /api/public/v1/nominations?page=1&pageSize=25
Authorization: Bearer <PUBLIC_API_KEY>
```

List response excerpt:

```json
{
  "data": [
    {
      "id": "123e4567-e89b-42d3-a456-426614174000",
      "reference": "SN-26/0022",
      "sailedAt": "2026-10-27T19:43:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

Detail request:

```http
GET /api/public/v1/nominations/123e4567-e89b-42d3-a456-426614174000
Authorization: Bearer <PUBLIC_API_KEY>
```

Detail response excerpt:

```json
{
  "data": {
    "id": "123e4567-e89b-42d3-a456-426614174000",
    "reference": "SN-26/0022",
    "dates": {
      "nominatedAt": "2026-10-20T13:00:00.000Z",
      "nominationRepliedAt": null,
      "laycanFrom": null,
      "laycanTo": null,
      "eta": "2026-10-25T12:00:00.000Z",
      "sailedAt": "2026-10-27T19:43:00.000Z"
    }
  }
}
```

Here `sailedAt` corresponds to 27 October 2026 at **16:43 in Uruguay (UTC−03:00)**.
The API always returns UTC (`Z`); consumers should convert it for local display.
When the activity is absent, the field is present with `"sailedAt": null` in the
same location. It is not replaced by ETA, laycan or the SOF creation date.

This is an additive response field; endpoint paths, authentication, pagination,
filters and sorting are unchanged. `sailedAt` is not a supported filter or sort
field. Availability in production requires deploying the updated application.
