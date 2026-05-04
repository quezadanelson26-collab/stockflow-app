// ─── Input Validation Helpers ───────────────────────────

export function isValidQuantity(value: unknown): value is number {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 && Number.isInteger(num);
}

export function sanitizeText(input: string, maxLength = 255): string {
  return input.trim().slice(0, maxLength);
}

export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
