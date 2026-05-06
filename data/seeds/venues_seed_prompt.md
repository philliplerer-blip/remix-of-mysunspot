# Prompt — Seed `venues` table with Copenhagen + Frederiksberg outdoor venues

Extend the app with a static, one-time seed of bars, restaurants, cafés, and rooftop venues in **Copenhagen and Frederiksberg** that have outdoor serving. **No external APIs, no scheduled refresh, no scraping.** This list is curated from multiple sources and is intended to ship with the app as static data.

**Before writing code, inspect the repo to determine the existing stack and ORM, and ask me clarifying questions if the schema below conflicts with existing models.**

---

## 1. Schema

Add a `venues` table:

```
venues (
  id              uuid primary key,
  name            text not null,
  lat             double precision,            -- nullable; some rows need geocoding (see §3)
  lng             double precision,
  neighborhood    text not null,
  venue_type      text[] not null,             -- subset of: restaurant, bar, cafe, rooftop
  outdoor_type    text[] not null,             -- subset of: terrace, garden, courtyard, rooftop, sidewalk
  confidence      text not null,               -- 'verified' | 'likely'
  sources         jsonb not null,              -- array of source identifiers
  note            text,                        -- optional free-text note
  imported_at     timestamptz not null default now(),
  unique(name, lat, lng)                       -- idempotency key
)
```

Indexes: `(neighborhood)`, `(confidence)`, GIN on `venue_type` and `outdoor_type`.

---

## 2. Confidence model (deterministic, no LLM judgment)

- `verified` — outdoor serving is attested by **two or more independent sources**, OR a single press source reproduced across multiple guides. Surface in the app without disclaimer.
- `likely` — outdoor serving is attested by **one source only** (e.g. a single keyword hit in a blogger's review). Surface in the app with a small "outdoor seating reported but not fully confirmed" disclaimer, or hide entirely behind a feature flag — my preference is to show with disclaimer.

Source identifiers used in the seed:

- `mymaps:to_sultne_piger` — the user's curated Google My Maps reference (food blogger reviews; outdoor signal extracted from review text where present)
- `kml_desc` — explicit outdoor keyword in the My Maps description (`udeservering`, `terrasse`, `gårdhave`, `udenfor`, etc.)
- `euroman` — Euroman.dk gastro guides ("De 5 bedste udeserveringer," "7 københavnske tagterrasser," "Spisesteder i solen," etc.)
- `femina` — Femina.dk lifestyle guides ("Rooftop-bar – de bedste tagterrasser," "Mad & Boligs favoritrestauranter," etc.)
- `migogkbh` — Mig & København (migogkbh.dk) outdoor-seating and rooftop guides
- `politiken` — Politiken/Ibyen restaurant reviews and "Årets Restaurant" awards
- `berlingske` — Berlingske restaurant reviews (incl. Søren Frank's column)
- `visitcopenhagen` — Visit Copenhagen guides
- `scandinaviastandard` — Scandinavia Standard "Best outdoor dining" guide
- `cofoco` — Cofoco's own outdoor-seating list (covers the Cofoco restaurant group)
- `rooftopguide` — therooftopguide.com Copenhagen list
- `metro.dk` — Copenhagen Metro's "5 cool rooftop terraces" guide
- `wonderfulcph` — Wonderful Copenhagen press kit
- `tripadvisor` — Tripadvisor "outdoor seating" filter
- `oregongirl` — oregongirlaroundtheworld outdoor-drinking guide
- `storyhunt` — storyhunt.io Frederiksberg guide
- `travelmag` / `71nyhavn` — Nyhavn restaurant guides
- `michelin` — Guide Michelin Nordic listing

---

## 3. Ingestion rules

- **Idempotent:** running the seeder twice must result in the same row count. Dedup key is `(name, lat, lng)` rounded to 4 decimals; if `lat`/`lng` are null, dedup by `name` alone.
- **Geocoding for null coordinates:** the press-only rows have `lat`/`lng = null`. Resolve them at seed time using a **bundled offline gazetteer** (e.g. a local CSV of known Copenhagen/Frederiksberg addresses) **OR** by manual lookup at PR-review time. Do not call any geocoding API at runtime. If a coordinate cannot be resolved at seed time, store the row with null coords and flag it for manual review — the app should still surface the venue in lists, just not on the map.
- **Bounding-box validation:** any row with non-null coords that falls outside `lat ∈ [55.610, 55.760]` and `lng ∈ [12.470, 12.700]` must be rejected and logged. This catches typos and accidental Aarhus rows.
- **Lat/lng order safety:** assert `lat ∈ [55, 56]` and `lng ∈ [12, 13]` for every inserted row. KML uses `lng,lat,alt` order — do not swap.
- **Trim and normalize names:** strip whitespace, normalize unicode (NFC), but preserve Danish characters (æ, ø, å, é).

---

## 4. Seed data

The seed is in `seed_venues.json` (also pasted inline below as the source of truth). **70 rows total: 17 multi-source verified (KML + press), 46 press-verified, 7 single-source likely.**

```json
[
  {"name": "Brasserie Prins", "lat": 55.673652, "lng": 12.553401, "neighborhood": "Frederiksberg", "venue_type": ["restaurant"], "outdoor_type": ["courtyard", "garden"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "kml_desc"]},
  {"name": "Fasangården", "lat": 55.67502, "lng": 12.521278, "neighborhood": "Frederiksberg", "venue_type": ["restaurant"], "outdoor_type": ["garden"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "visitcopenhagen"]},
  {"name": "Mielcke & Hurtigkarl", "lat": 55.674722, "lng": 12.530857, "neighborhood": "Frederiksberg", "venue_type": ["restaurant"], "outdoor_type": ["garden"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "visitcopenhagen"]},
  {"name": "Les Trois Cochons", "lat": 55.673856, "lng": 12.549994, "neighborhood": "Frederiksberg/Vesterbro", "venue_type": ["restaurant"], "outdoor_type": ["sidewalk"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "cofoco"]},
  {"name": "Bottega Barlie", "lat": 55.687329, "lng": 12.585645, "neighborhood": "Indre By", "venue_type": ["restaurant"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "visitcopenhagen"]},
  {"name": "Bøf & Ost", "lat": 55.679688, "lng": 12.575917, "neighborhood": "Indre By", "venue_type": ["restaurant"], "outdoor_type": ["courtyard"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "kml_desc", "visitcopenhagen"]},
  {"name": "Pastis", "lat": 55.682499, "lng": 12.582087, "neighborhood": "Indre By", "venue_type": ["restaurant"], "outdoor_type": ["sidewalk"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "kml_desc"]},
  {"name": "Picnic på Glyptoteket", "lat": 55.672942, "lng": 12.572643, "neighborhood": "Indre By", "venue_type": ["cafe"], "outdoor_type": ["rooftop"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "visitcopenhagen"]},
  {"name": "Sticks'n'Sushi", "lat": 55.669697, "lng": 12.554685, "neighborhood": "Indre By", "venue_type": ["restaurant"], "outdoor_type": ["rooftop"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "rooftopguide", "euroman"]},
  {"name": "Kødbyens Fiskebar", "lat": 55.667903, "lng": 12.559233, "neighborhood": "Kødbyen", "venue_type": ["restaurant"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "scandinaviastandard", "visitcopenhagen", "migogkbh"]},
  {"name": "BRUS", "lat": 55.692154, "lng": 12.556134, "neighborhood": "Nørrebro", "venue_type": ["bar"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "visitcopenhagen"]},
  {"name": "La Banchina", "lat": 55.689304, "lng": 12.610927, "neighborhood": "Refshaleøen", "venue_type": ["cafe"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "scandinaviastandard", "visitcopenhagen"]},
  {"name": "Rakils Spisehus - BaneGaarden", "lat": 55.658567, "lng": 12.542464, "neighborhood": "Sydhavn", "venue_type": ["restaurant"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "kml_desc"]},
  {"name": "Café Dyrehaven", "lat": 55.665668, "lng": 12.549604, "neighborhood": "Vesterbro", "venue_type": ["cafe"], "outdoor_type": ["sidewalk"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "oregongirl"]},
  {"name": "Juli Pizzeria", "lat": 55.698449, "lng": 12.54304, "neighborhood": "Vesterbro", "venue_type": ["restaurant"], "outdoor_type": ["sidewalk"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "kml_desc"]},
  {"name": "RASCAL", "lat": 55.680008, "lng": 12.548716, "neighborhood": "Vesterbro", "venue_type": ["restaurant"], "outdoor_type": ["sidewalk"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "kml_desc"]},
  {"name": "Hos Fischer", "lat": 55.701838, "lng": 12.580713, "neighborhood": "Østerbro", "venue_type": ["restaurant"], "outdoor_type": ["courtyard"], "confidence": "verified", "sources": ["mymaps:to_sultne_piger", "kml_desc"]},
  {"name": "Pirlo", "lat": null, "lng": null, "neighborhood": "Amager", "venue_type": ["restaurant"], "outdoor_type": ["courtyard", "garden"], "confidence": "verified", "sources": ["berlingske"], "note": "Berlingske Søren Frank review; cozy backyard"},
  {"name": "Tramonto", "lat": null, "lng": null, "neighborhood": "Carlsberg Byen", "venue_type": ["restaurant"], "outdoor_type": ["rooftop"], "confidence": "verified", "sources": ["scandinaviastandard", "visitcopenhagen", "rooftopguide", "migogkbh"]},
  {"name": "Circolo", "lat": null, "lng": null, "neighborhood": "Frederiksberg", "venue_type": ["restaurant"], "outdoor_type": ["terrace", "sidewalk"], "confidence": "verified", "sources": ["femina"], "note": "Tuscan; outdoor seating along Gammel Kongevej"},
  {"name": "Italo Caffé", "lat": null, "lng": null, "neighborhood": "Frederiksberg", "venue_type": ["cafe"], "outdoor_type": ["sidewalk"], "confidence": "verified", "sources": ["euroman"], "note": "Værnedamsvej; intimate outdoor seating"},
  {"name": "Piola Pastificio", "lat": null, "lng": null, "neighborhood": "Frederiksberg", "venue_type": ["restaurant"], "outdoor_type": ["sidewalk", "terrace"], "confidence": "verified", "sources": ["storyhunt"]},
  {"name": "Restaurant Gemini", "lat": null, "lng": null, "neighborhood": "Frederiksberg", "venue_type": ["restaurant"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["migogkbh"], "note": "Gl. Kongevej 10; entry from water side, by Sankt Jørgens Sø"},
  {"name": "Scarpetta", "lat": null, "lng": null, "neighborhood": "Frederiksberg", "venue_type": ["restaurant"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["cofoco", "visitcopenhagen"]},
  {"name": "Apollo Bar", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["restaurant"], "outdoor_type": ["terrace", "courtyard"], "confidence": "verified", "sources": ["scandinaviastandard", "visitcopenhagen"]},
  {"name": "Boltens Gård", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["restaurant", "bar"], "outdoor_type": ["courtyard"], "confidence": "verified", "sources": ["euroman"], "note": "Food market on Gothersgade"},
  {"name": "Brewpub", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["bar"], "outdoor_type": ["courtyard", "garden"], "confidence": "verified", "sources": ["tripadvisor", "visitcopenhagen"]},
  {"name": "Café på Post & Tele Museum", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["cafe"], "outdoor_type": ["rooftop"], "confidence": "verified", "sources": ["euroman"], "note": "Rooftop café atop the Post Museum, Købmagergade"},
  {"name": "Darling Bistro & Bar", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["restaurant", "bar"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["berlingske"], "note": "Terrace facing Slotsholm canals, Christiansborg view"},
  {"name": "Hotel Danmark Rooftop", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["rooftop", "bar"], "outdoor_type": ["rooftop", "terrace"], "confidence": "verified", "sources": ["femina"], "note": "Views of Rådhuspladsen + Tivoli; summer DJ"},
  {"name": "Hotel Grand Joanne Rooftop", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["rooftop", "bar"], "outdoor_type": ["rooftop", "terrace"], "confidence": "verified", "sources": ["femina"], "note": "Near Central Station; opened 2023"},
  {"name": "Hotel SP34 Rooftop", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["rooftop", "bar"], "outdoor_type": ["rooftop", "courtyard"], "confidence": "verified", "sources": ["euroman"], "note": "First-floor terrace tucked in courtyard"},
  {"name": "Illum Rooftop", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["rooftop"], "outdoor_type": ["rooftop", "terrace"], "confidence": "verified", "sources": ["visitcopenhagen", "metro.dk"]},
  {"name": "Kismet", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["cafe"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["euroman"], "note": "South-facing terrace"},
  {"name": "Llama", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["restaurant"], "outdoor_type": ["terrace", "courtyard"], "confidence": "verified", "sources": ["cofoco"]},
  {"name": "Manon Les Suites", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["rooftop"], "outdoor_type": ["rooftop"], "confidence": "verified", "sources": ["rooftopguide", "visitcopenhagen"]},
  {"name": "Petanque", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["bar"], "outdoor_type": ["rooftop", "terrace"], "confidence": "verified", "sources": ["euroman"], "note": "Rosé + boule on a rooftop court"},
  {"name": "Restaurant Babylon (Søpavillonen)", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["restaurant"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["migogkbh"], "note": "Large terrace overlooking Peblinge Sø"},
  {"name": "Restaurant Tårnet", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["restaurant"], "outdoor_type": ["terrace", "rooftop"], "confidence": "verified", "sources": ["politiken", "berlingske"], "note": "Atop Christiansborg tower; outdoor terrace; widely reviewed"},
  {"name": "Roof Bar", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["rooftop"], "outdoor_type": ["rooftop"], "confidence": "verified", "sources": ["rooftopguide", "femina", "migogkbh"]},
  {"name": "Seaside Toldboden", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["restaurant", "bar", "cafe"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["migogkbh"], "note": "Nordre Toldbod 18–24; multiple kitchens, harbor-front terrace"},
  {"name": "Vækst", "lat": null, "lng": null, "neighborhood": "Indre By", "venue_type": ["restaurant"], "outdoor_type": ["courtyard"], "confidence": "verified", "sources": ["cofoco", "visitcopenhagen"]},
  {"name": "Bistro Summér", "lat": null, "lng": null, "neighborhood": "Indre By/Nyhavn", "venue_type": ["restaurant"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["travelmag", "71nyhavn"]},
  {"name": "Corsa Nordhavn", "lat": null, "lng": null, "neighborhood": "Nordhavn", "venue_type": ["restaurant"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["cofoco", "visitcopenhagen"]},
  {"name": "Restaurant Silo", "lat": null, "lng": null, "neighborhood": "Nordhavn", "venue_type": ["restaurant", "rooftop"], "outdoor_type": ["rooftop"], "confidence": "verified", "sources": ["femina", "migogkbh"], "note": "17th floor; panoramic Copenhagen views"},
  {"name": "Restaurant Judie", "lat": null, "lng": null, "neighborhood": "Nyhavn", "venue_type": ["restaurant"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["wonderfulcph"]},
  {"name": "Kima", "lat": null, "lng": null, "neighborhood": "Nørrebro", "venue_type": ["restaurant"], "outdoor_type": ["sidewalk"], "confidence": "verified", "sources": ["euroman"], "note": "Frederiksborgvej; tables on small square"},
  {"name": "Lunden", "lat": null, "lng": null, "neighborhood": "Nørrebro", "venue_type": ["restaurant"], "outdoor_type": ["garden"], "confidence": "verified", "sources": ["oregongirl"]},
  {"name": "Aure", "lat": null, "lng": null, "neighborhood": "Refshaleøen", "venue_type": ["restaurant"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["wonderfulcph", "michelin"]},
  {"name": "Reffen", "lat": null, "lng": null, "neighborhood": "Refshaleøen", "venue_type": ["restaurant"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["visitcopenhagen"]},
  {"name": "PAULI", "lat": null, "lng": null, "neighborhood": "Sydhavn", "venue_type": ["restaurant", "bar"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["politiken"], "note": "Politiken Ibyen 'Årets Restaurant' 2023; outdoor seating"},
  {"name": "Café Asta", "lat": null, "lng": null, "neighborhood": "Valby", "venue_type": ["cafe"], "outdoor_type": ["terrace", "sidewalk"], "confidence": "verified", "sources": ["migogkbh"], "note": "Yellow house on Valby Langgade"},
  {"name": "Corsa Vesterbro", "lat": null, "lng": null, "neighborhood": "Vesterbro", "venue_type": ["restaurant"], "outdoor_type": ["sidewalk"], "confidence": "verified", "sources": ["cofoco"]},
  {"name": "Do More", "lat": null, "lng": null, "neighborhood": "Vesterbro", "venue_type": ["restaurant", "rooftop"], "outdoor_type": ["rooftop", "terrace"], "confidence": "verified", "sources": ["berlingske", "migogkbh"], "note": "Rooftop on top of IKEA Dybbølsbro; 'Scandirabian' kitchen"},
  {"name": "H15 Halmtorvet", "lat": null, "lng": null, "neighborhood": "Vesterbro", "venue_type": ["restaurant", "bar"], "outdoor_type": ["terrace"], "confidence": "verified", "sources": ["euroman"], "note": "Sunny terrace; Euroman 'Spisesteder i solen'"},
  {"name": "KAJEN", "lat": null, "lng": null, "neighborhood": "Vesterbro", "venue_type": ["restaurant", "bar", "rooftop"], "outdoor_type": ["rooftop", "terrace"], "confidence": "verified", "sources": ["migogkbh"], "note": "Fisketorvet; 426 m² rooftop terrace, harbor views"},
  {"name": "Level Six", "lat": null, "lng": null, "neighborhood": "Vesterbro", "venue_type": ["rooftop"], "outdoor_type": ["rooftop"], "confidence": "verified", "sources": ["rooftopguide", "migogkbh"]},
  {"name": "Lidkoeb", "lat": null, "lng": null, "neighborhood": "Vesterbro", "venue_type": ["bar"], "outdoor_type": ["courtyard"], "confidence": "verified", "sources": ["euroman"], "note": "Cozy half-timbered courtyard"},
  {"name": "Restaurant Cofoco", "lat": null, "lng": null, "neighborhood": "Vesterbro", "venue_type": ["restaurant"], "outdoor_type": ["sidewalk"], "confidence": "verified", "sources": ["cofoco"]},
  {"name": "Tivoli Biergarten", "lat": null, "lng": null, "neighborhood": "Vesterbro/Tivoli", "venue_type": ["bar"], "outdoor_type": ["garden"], "confidence": "verified", "sources": ["tripadvisor"]},
  {"name": "Corsa Østerbro", "lat": null, "lng": null, "neighborhood": "Østerbro", "venue_type": ["restaurant"], "outdoor_type": ["sidewalk", "terrace"], "confidence": "verified", "sources": ["cofoco"]},
  {"name": "Gro Spiseri (ØsterGRO)", "lat": null, "lng": null, "neighborhood": "Østerbro", "venue_type": ["restaurant"], "outdoor_type": ["rooftop", "garden"], "confidence": "verified", "sources": ["euroman", "migogkbh"], "note": "Rooftop urban farm in Østerbro; historic operators include Stedsans, currently Gro Spiseri"},
  {"name": "Pavillon", "lat": null, "lng": null, "neighborhood": "Østerbro", "venue_type": ["bar"], "outdoor_type": ["garden"], "confidence": "verified", "sources": ["visitcopenhagen"]},
  {"name": "Enghave Plads (Kaffe/Kage)", "lat": 55.667222, "lng": 12.546682, "neighborhood": "Frederiksberg", "venue_type": ["restaurant"], "outdoor_type": ["sidewalk"], "confidence": "likely", "sources": ["mymaps:to_sultne_piger"], "note": "KML description keyword hits: ['udenfor']"},
  {"name": "Sonny", "lat": 55.676964, "lng": 12.574255, "neighborhood": "Indre By", "venue_type": ["restaurant"], "outdoor_type": ["sidewalk"], "confidence": "likely", "sources": ["mymaps:to_sultne_piger"], "note": "KML description keyword hits: ['udenfor']"},
  {"name": "Arrebo", "lat": 55.701046, "lng": 12.541909, "neighborhood": "Nørrebro", "venue_type": ["restaurant"], "outdoor_type": ["sidewalk"], "confidence": "likely", "sources": ["mymaps:to_sultne_piger"], "note": "KML description keyword hits: ['udenfor']"},
  {"name": "Istanbul Chicken", "lat": 55.702674, "lng": 12.53357, "neighborhood": "Nørrebro", "venue_type": ["restaurant"], "outdoor_type": ["sidewalk"], "confidence": "likely", "sources": ["mymaps:to_sultne_piger"], "note": "KML description keyword hits: ['udenfor']"},
  {"name": "Bar La Una", "lat": 55.667981, "lng": 12.550213, "neighborhood": "Vesterbro", "venue_type": ["restaurant"], "outdoor_type": ["sidewalk"], "confidence": "likely", "sources": ["mymaps:to_sultne_piger"], "note": "KML description keyword hits: ['udenfor']"},
  {"name": "DEJ", "lat": 55.668254, "lng": 12.556653, "neighborhood": "Vesterbro", "venue_type": ["restaurant"], "outdoor_type": ["sidewalk"], "confidence": "likely", "sources": ["mymaps:to_sultne_piger"], "note": "KML description keyword hits: ['udeservering']"},
  {"name": "Wedo Halmtorvet", "lat": 55.668969, "lng": 12.55805, "neighborhood": "Vesterbro", "venue_type": ["restaurant"], "outdoor_type": ["sidewalk"], "confidence": "likely", "sources": ["mymaps:to_sultne_piger"], "note": "KML description keyword hits: ['udenfor']"}
]
```

---

## 5. Tests the agent must add

- Schema migration runs cleanly forward and back.
- Seeder is idempotent: running twice yields the same row count.
- Bounding-box validation rejects a synthetic row at `lat=56.15` (Aarhus) and logs it.
- Lat/lng order check catches a swapped row (e.g. `lat=12.55, lng=55.67`).
- Confidence values are exactly `verified` or `likely` — no other strings.
- Every row has `sources.length >= 1` and (if `confidence='verified'`) either `sources.length >= 2` OR a source from the press allowlist.
- Filter query "give me all `verified` rooftops in Indre By" returns the expected fixed set.
- Geocoding-pending rows (null coords) are still queryable by neighborhood and surfaced in lists, just hidden from map views.

---

## 6. Deliverable

- A populated `venues` table with all 46 rows.
- A CSV export of the table for audit (`name, neighborhood, venue_type, outdoor_type, confidence, sources_count`).
- A `seeding.md` README section documenting:
  - This is a one-time static import, not refreshed automatically.
  - How to add a new row (edit the seed file + run `bin/seed:venues`).
  - How to mark a row as removed (soft-delete column, do not hard-delete — preserves history).
  - The sources legend from §2.

---

## 7. Open product decisions for the user

Flag these for me to answer rather than guessing:

1. **Should `likely`-confidence rows be visible by default?** Default in this prompt is "yes, with disclaimer." Alternative: hide behind a feature flag.
2. **How should geocoding gaps be resolved?** The 22 press-only rows have null coords. Options: (a) I provide coordinates manually before the seed runs, (b) the agent uses a one-time bundled offline gazetteer at seed time, (c) leave null and surface only in list views until I fill them in. Default in this prompt is (c) — flag pending rows and proceed.
3. **Soft-delete vs. hard-delete** for venues that close — recommendation: soft-delete with `closed_at` column.
