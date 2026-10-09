/**
 * Arithmetic check on amounts.
 * The percent is recalculated from the amounts and overwrites any value passed in.
 */
export function checkAmounts({ base, extra, sum, percent = null }) {
  for (const [key, value] of Object.entries({ base, extra, sum })) {
    if (!Number.isSafeInteger(value) || value < 0)
      return { status: "REVIEW_REQUIRED", reason: "Invalid integer: " + key };
  }
  if (base === 0)
    return { status: "REVIEW_REQUIRED", reason: "Zero base" };
  if (base + extra !== sum)
    return { status: "REVIEW_REQUIRED", reason: "base + extra != sum" };

  // Overwrite the old value with the calculated one, rounded to 2 decimals
  percent = Math.round((100 * extra / base) * 100) / 100;

  return { status: "PASS_ARITHMETIC", percent, base, extra, sum };
}
