/**
 * Read-only VAT arithmetic verification from source data.
 * Rates are descriptive observations, never legal tax determinations.
 */
export function inspectVat({subtotal,vat,total,declaredRate=null}) {
  for (const [key,value] of Object.entries({subtotal,vat,total})) {
    if (!Number.isSafeInteger(value) || value<0)
      return {status:"REVIEW_REQUIRED",reason:"Invalid integer VND: "+key};
  }
  if (subtotal===0)
    return {status:"REVIEW_REQUIRED",reason:"Zero subtotal"};
  if (subtotal+vat!==total)
    return {status:"REVIEW_REQUIRED",reason:"subtotal + vat != total"};

  const observedRate=100*vat/subtotal;
  // Rounded only for display. Keep unrounded observedRate in results.
  const calculatedRate=Math.round(observedRate*100)/100;
  if(declaredRate!==null){
    if(!Number.isFinite(declaredRate)||declaredRate<0)
      return {status:"REVIEW_REQUIRED",reason:"Invalid declared rate"};
    if(Math.abs(Math.round(subtotal*declaredRate/100)-vat)>1)
      return {status:"REVIEW_REQUIRED",observedRate,calculatedRate,reason:"Declared rate does not match VAT amount"};
  }
  return {status:"PASS_ARITHMETIC",calculatedRate,observedRate,total};
}
