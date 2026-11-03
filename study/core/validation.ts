export function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
export function id(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value); }
export function text(value: unknown, max = 2000): value is string { return typeof value === 'string' && value.length > 0 && value.length <= max; }
export function date(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
export function tuple(value: unknown, size: number): value is number[] { return Array.isArray(value) && value.length === size && value.every(finite); }
export function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
export function exact(value: Record<string, unknown>, keys: readonly string[]) { return Object.keys(value).every(key => keys.includes(key)); }
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
