/**
 * VAT arithmetic verification for invoice reconciliation.
 * This module never changes source invoices or decides tax eligibility.
 */
export function inspectVat({subtotal, vat, total, declaredRate=null}) {
  for (const [key,value] of Object.entries({subtotal,vat,total})) {
    if (!Number.isSafeInteger(value) || value<0) {
      return {status:"REVIEW_REQUIRED",reason:"Invalid integer VND: "+key};
    }
  }
  if (subtotal === 0) return {status:"REVIEW_REQUIRED",reason:"Zero subtotal"};
  if (subtotal + vat !== total) {
    return {status:"REVIEW_REQUIRED",reason:"subtotal + vat != total"};
  }
  const observedRate = 100 * vat / subtotal;
  const rates = [8,10];
  const matched = rates.find(rate=>Math.abs(Math.round(subtotal*rate/100)-vat)<=1);
  if (matched === undefined) {
    return {status:"REVIEW_REQUIRED",observedRate,reason:"Outside supported 8%/10% verification or unexpected rounding"};
  }
  if (declaredRate !== null && declaredRate !== matched) {
    return {status:"REVIEW_REQUIRED",observedRate,calculatedRate:matched,reason:"Declared rate does not match arithmetic"};
  }
  return {status:"PASS_ARITHMETIC",calculatedRate:matched,observedRate,total};
}
