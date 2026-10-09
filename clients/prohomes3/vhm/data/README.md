# VHM source data

Imported from workbook:

`FN - THÔNG TIN LÀM HÓA ĐƠN - VIN HÓC MÔN - ĐÃ SẮP XẾP NGÀY GIỜ (1).xlsx`

## Imported files

- `t7-2026.json`: 36 scenario rows
- `t8-2026.json`: 37 scenario rows
- `t9-2026.json`: 45 scenario rows
- `original-21-receipts.json`: all 21 yellow source receipts

Total scenario rows: 118 = 20 real rows + 98 simulated rows.

The hidden source sheet contains 21 yellow real receipts. The 1 VND receipt
`28912996511722384-28880512304970802` is present in the original 21-receipt source
but is not included in the 118-row scenario sheet. This discrepancy is preserved;
nothing is inferred or silently inserted into the scenario.

Two original receipts have missing subtotal/VAT in the workbook and remain null:
- `28401546462867395-28244515611903810` (total 1,478 VND, ad credit)
- `28912996511722384-28880512304970802` (total 1 VND, prepaid balance)

Do not invent invoice numbers for simulated rows.
