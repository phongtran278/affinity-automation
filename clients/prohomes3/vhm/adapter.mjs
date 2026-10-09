/**
 * VHM source adapter.
 *
 * VHM data is intentionally treated as a separate schema from ProHomes.
 * Implement this only after real VHM source samples and PDF structure are known.
 *
 * The adapter must return the normalized model expected by the shared core.
 * Never guess missing required fields.
 */
export function normalizeVhmSource(_raw, _profile) {
  throw new Error(
    "VHM adapter chưa được cấu hình: cần source data thật + cấu trúc PDF VHM trước khi chạy."
  );
}
