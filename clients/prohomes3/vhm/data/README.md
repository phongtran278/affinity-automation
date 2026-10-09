# VHM source data

Imported from workbook:

`FN - THÔNG TIN LÀM HÓA ĐƠN - VIN HÓC MÔN - ĐÃ SẮP XẾP NGÀY GIỜ (1).xlsx`

## Imported files

- `t7-2026.json`: 36 scenario rows
- `t8-2026.json`: 37 scenario rows
- `t9-2026.json`: 45 scenario rows
- `original-21-receipts.json`: 20 retained yellow source receipts after one user-requested exclusion

Total scenario rows: 118 = 20 real rows + 98 simulated rows.

The original yellow source set had 21 receipts. Transaction `28912996511722384-28880512304970802` was explicitly excluded by user request, leaving 20 retained yellow receipts. The scenario sheet already did not include this transaction.

Two original receipts have missing subtotal/VAT in the workbook and remain null:
- `28401546462867395-28244515611903810` (total 1,478 VND, ad credit)

## Invoice-number derivation

Verified yellow-row invoice numbers use prefix `FBADS-542-` and their 9-digit suffix increases monotonically with document timestamp.

For scenario rows without a verified FBADS number, the JSON uses the same deterministic policy used by the earlier ProHomes dataset:
- preserve verified anchors exactly;
- linearly interpolate the numeric suffix by timestamp between the nearest verified anchors;
- linearly extrapolate before/after the anchor range;
- force generated suffixes to remain strictly increasing by timestamp.

Every generated row is marked `invoiceNumberKind: "time-interpolated"`. Verified rows are marked `"verified-anchor"`.

The 2026-08-22 ad-credit receipt has no FBADS in the source, so its `invoiceNumber` remains `null` with `invoiceNumberKind: "not-present-in-source"`.

The previously excluded 2026-09-30 receipt is not restored to the 118-row scenario. Its verified FBADS value is used only as a terminal calibration anchor for interpolation.

Generated invoice numbers are deterministic simulation identifiers, not verified Meta-issued invoice numbers.
