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

Do not invent invoice numbers for simulated rows.
