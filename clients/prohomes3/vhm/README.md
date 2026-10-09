# ProHomes3 / VHM

VHM is an independent brand under ProHomes3.

## Rules

- VHM source data is independent from the existing ProHomes data.
- Do not copy ProHomes JSON and silently reinterpret fields.
- Shared Affinity compatibility/safety stays in `core/`.
- VHM-specific parsing, source normalization and business rules stay under this directory.
- No VHM runner should be enabled until its source schema and PDF structure are validated with real samples.

## Layout

```
clients/prohomes3/vhm/
  client.mjs
  adapter.mjs
  profiles/
  data/
```

The existing ProHomes T7/T8/T9 workflow remains untouched while VHM is being built.
