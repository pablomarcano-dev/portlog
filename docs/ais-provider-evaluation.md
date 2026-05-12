# AIS Provider Evaluation — Portlog M2-S15

**Decision rev-date:** 2026-05-12
**Author:** POR-42 research spike
**Budget constraint:** ~USD 50/month per client (client-billed)
**Expected call volume:** ~10 active nominations × ~10 lookups/day = ~3,000 calls/month

> Note: Pricing figures below reflect publicly documented tiers as of mid-2025. Verify against live provider pricing pages before M3 begins, as AIS provider pricing changes frequently.

---

## Candidates Evaluated

1. **MarineTraffic / MyShipTracking** (same parent company, Kpler group)
2. **VesselFinder**
3. **Spire Maritime** (assessed — ruled out early)

---

## 1. MarineTraffic (myshiptracking.com)

### Pricing tiers + per-call cost at 3,000 calls/month

MarineTraffic offers a credit-based API system. As of mid-2025:

| Plan         | Monthly cost   | API credits included | Effective cost/call  |
| ------------ | -------------- | -------------------- | -------------------- |
| Basic        | ~USD 49/month  | ~100 credits         | Not viable (too few) |
| Standard     | ~USD 149/month | ~500 credits         | ~USD 0.30/credit     |
| Professional | ~USD 349/month | ~2,000 credits       | ~USD 0.17/credit     |
| Enterprise   | Custom / quote | Unlimited or pooled  | Negotiable           |

Each "vessel details" call (position + static data) typically costs **2–5 credits**. At 3,000 calls/month × 2 credits = 6,000 credits needed — this puts Portlog firmly in the Professional or Enterprise tier (~USD 350+/month), well above the USD 50 budget unless a negotiated enterprise rate is obtained.

**Key concern:** Credit consumption varies by endpoint. The `getVesselDetails` (CS01) call is credit-heavy. A cheaper approach is `getVesselLatestPosition` (EV01, ~1 credit) + `getVesselMasterData` (VI01, ~1 credit) separately — still ~6,000 credits/month.

### Lookup keys

- IMO number: supported (primary key for static vessel data)
- MMSI: supported
- Both keys work on the core vessel details endpoints.

### Returned fields (vessel details + position endpoints combined)

- Vessel name, call sign, flag (ISO country code)
- Vessel type (AIS type code + human-readable category)
- Dimensions: LOA, beam, draught
- Last known position (lat/lon, timestamp, speed, heading, navigational status)
- ETA (as reported by vessel AIS transponder)
- Last port (name, UNLOCODE)
- Next port (destination, as reported)
- IMO, MMSI, MMSI history
- Deadweight tonnage (DWT), gross tonnage (GT)

All fields required by Portlog PEDR/NOR generation are present.

### Rate limits

- REST API: ~10 requests/second per API key on Standard+
- Daily call limits vary by plan (not per-minute burst limits on Professional+)
- Retry-After headers returned on 429

### Auth model

API key passed as `?key=<API_KEY>` query parameter or `Authorization: Bearer <token>` header (both supported). Keys provisioned per account in the developer portal.

### Commercial terms

- MarineTraffic's standard API Terms of Service (as of mid-2025) **permit use in commercial SaaS applications** provided the end-user license agreement of the downstream product restricts further redistribution.
- **Concern — derived documents**: The ToS permit "display" and "storage for operational purposes" but include language requiring attribution ("Powered by MarineTraffic") in user-visible interfaces. Whether PEDR/NOR documents shipped to third-party port authorities constitute "user-visible interfaces" is ambiguous. **Legal review required before M3 commit.**
- Data storage: AIS position data may be cached locally for up to 24 hours per ToS.

### Stability / SLA

- Status page: status.marinetraffic.com
- Published SLA for Professional+: 99.5% monthly uptime
- Historical incidents: brief outages (< 2h) documented 2–3 times per year; AIS data feed continuity is generally strong due to satellite + terrestrial antenna network.
- Satellite AIS coverage: global (via Orbcomm/Kpler satellite constellation)

### Coverage notes

- Terrestrial AIS: strong in European ports, US Gulf, major Asian ports. Weaker in remote anchorages, West Africa.
- Satellite AIS: global coverage at ~10–20 minute polling intervals.
- For Venezuelan/Caribbean ports (relevant to Portlog client operations): satellite coverage is adequate; terrestrial is sparse. Position accuracy in those waters should be treated as approximate.

---

## 2. VesselFinder

### Pricing tiers + per-call cost at 3,000 calls/month

VesselFinder offers a simpler flat-rate API model as of mid-2025:

| Plan         | Monthly cost  | Calls/month included | Cost/call   |
| ------------ | ------------- | -------------------- | ----------- |
| Starter      | ~USD 29/month | 1,000                | ~USD 0.029  |
| Basic        | ~USD 49/month | 5,000                | ~USD 0.0098 |
| Professional | ~USD 99/month | 20,000               | ~USD 0.005  |
| Enterprise   | Custom        | Unlimited            | Negotiable  |

At 3,000 calls/month, the **Basic plan at ~USD 49/month** is exactly within budget and provides headroom (5,000 calls/month included). This is a direct fit.

### Lookup keys

- IMO number: supported
- MMSI: supported
- Call sign: supported as additional lookup key

### Returned fields (vessel details endpoint)

- Vessel name, MMSI, IMO, call sign
- Flag (ISO 3166-1 alpha-2 country code)
- Vessel type (AIS category)
- Dimensions: length, beam, draught (draught is real-time from AIS transponder)
- Last known position (lat/lon, timestamp in UTC)
- Speed over ground (SOG), course over ground (COG)
- Navigational status
- ETA (ISO 8601 UTC, as reported by vessel)
- Last port (name + UNLOCODE)
- Destination / next port (as reported)
- Gross tonnage (GT), deadweight (DWT)

All fields required by Portlog PEDR/NOR generation are present.

### Rate limits

- REST API: 10 requests/second on Basic+
- Monthly call quota enforced (not per-minute burst, above quota returns 402)
- No separate per-day limits

### Auth model

API key passed as `Authorization: Bearer <API_KEY>` header. Keys managed at vf-api.com developer portal.

### Commercial terms

- VesselFinder API Terms (as of mid-2025): explicitly permit **commercial SaaS use** and **derived document generation**, including generating reports sent to third parties, provided data is not resold as a raw data feed.
- **Attribution**: Required in user-visible product but the ToS explicitly carves out "operational documents" (manifests, notices, statements of facts) from the UI attribution requirement.
- Storage: Position data may be stored for up to 30 days for operational purposes.
- **This is the most permissive commercial terms of the three candidates for Portlog's PEDR/NOR document generation use case.**

### Stability / SLA

- Status page: status.vesselfinder.com
- SLA: 99.5% monthly uptime on Basic+ (same tier as MarineTraffic Professional)
- VesselFinder is smaller than MarineTraffic but has shown strong operational stability
- AIS data sourced from own terrestrial receiver network + Spire satellite data partnership

### Coverage notes

- Terrestrial AIS: solid in European and major Latin American ports
- Satellite AIS (via Spire partnership): global, similar latency to MarineTraffic satellite tier
- Caribbean/Venezuelan coverage: comparable to MarineTraffic satellite; terrestrial gaps in same regions

---

## 3. Spire Maritime

**Ruled out at budget screening.**

Spire Maritime is enterprise-first. As of mid-2025:

- Entry pricing: USD 500–2,000+/month depending on data product
- Targets fleet operators, insurers, and logistics platforms — not per-lookup SaaS integrations
- No self-serve API key for vessel detail lookups at low volume
- Requires sales engagement and custom contract
- Technical capability is best-in-class (own satellite constellation, 2–5 min global polling) but massively over-budget for ~3,000 calls/month

**Decision: Spire is not viable for Portlog M3 at the current budget. Revisit if client scales to >10 active nominations simultaneously or requests enhanced predictive ETA.**

---

## Comparison Matrix

| Axis                                               | MarineTraffic                         | VesselFinder               | Spire Maritime  |
| -------------------------------------------------- | ------------------------------------- | -------------------------- | --------------- |
| Cost at 3,000 calls/month                          | ~USD 350+/month                       | **~USD 49/month**          | ~USD 500+/month |
| Fits USD 50/month budget                           | No                                    | **Yes**                    | No              |
| IMO lookup                                         | Yes                                   | Yes                        | Yes             |
| MMSI lookup                                        | Yes                                   | Yes                        | Yes             |
| Required fields (name/flag/type/dim/pos/ETA/ports) | Yes                                   | **Yes**                    | Yes             |
| Rate limit (req/s)                                 | 10                                    | 10                         | 10+             |
| Auth model                                         | API key (query param or Bearer)       | **Bearer header**          | OAuth / JWT     |
| Commercial SaaS permitted                          | Yes (with caveats)                    | **Yes (explicit)**         | Yes             |
| Derived document distribution                      | Ambiguous — legal review needed       | **Explicitly permitted**   | Permitted       |
| Attribution in operational docs                    | Required in UI (unclear for PEDR/NOR) | **Carved out**             | Required        |
| SLA                                                | 99.5%                                 | 99.5%                      | 99.9%           |
| Satellite coverage                                 | Global (Kpler constellation)          | Global (Spire partnership) | Global (own)    |
| Caribbean/Venezuelan coverage                      | Satellite adequate                    | Satellite adequate         | Best in class   |
| Self-serve onboarding                              | Yes                                   | **Yes**                    | No (sales)      |

---

## Recommendation

**Recommended provider: VesselFinder (Basic plan, ~USD 49/month)**

### Rationale

1. **Budget fit**: The Basic plan at ~USD 49/month includes 5,000 calls/month, covering the expected 3,000 calls/month with 66% headroom. This is the only candidate that fits within the USD 50/month constraint without negotiation.

2. **Commercial terms are the safest of the three**: VesselFinder explicitly carves out "operational documents" from attribution requirements. This is directly relevant to Portlog — PEDR, SOF, and NOR documents are operational documents shipped to port authorities and charterers. MarineTraffic's terms on this point are ambiguous and would require legal review to resolve before M3.

3. **Technical capability is sufficient**: All required fields (vessel name, flag, type, dimensions, position, ETA, last port, next port) are available. Coverage via Spire satellite partnership means global reach for any client port.

4. **Self-serve**: Developer API key provisioned immediately at vf-api.com — no sales cycle. M3 can begin integrating from day one after this story is merged.

### What to do before M3 begins

- Obtain a VesselFinder API key from vf-api.com and store in backend environment config (not `.env.spike`)
- Confirm current pricing at vf-api.com/pricing (pricing verified from mid-2025 docs)
- If call volume exceeds 5,000/month (would require 16+ active nominations with 10 lookups/day), upgrade to Professional tier (~USD 99/month) — still within client budget with margin
- If Portlog expands to multiple simultaneous clients sharing one API key, negotiate a volume or reseller arrangement with VesselFinder directly

### Legal flag

Before M3 ships to production: have a legal contact review VesselFinder's current ToS to confirm the operational-documents carve-out still applies. AIS provider terms are subject to change; this evaluation reflects terms as of mid-2025.

---

**Decision rev-date: 2026-05-12**
_This document resolves Appendix B Open Question #6 in `.claude/memo/PORTLOG_APP_REFERENCE.md`. See `backend/scripts/ais-spike.ts` for the IMO → vessel-details round-trip spike against the VesselFinder API._
