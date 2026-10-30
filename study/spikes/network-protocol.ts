/** Temporary S2 messages; formal experiment messages belong to M2/M4. */
export type CheckRole = 'console' | 'participant';
export type PeerState = { console: boolean; participant: boolean };
export type ClientMessage =
  | { type: 'hello'; data: { role: CheckRole; protocolVersion: 1 } }
  | { type: 'check.send' | 'check.received'; data: { id: string } };
export type ServerMessage =
  | { type: 'ready'; data: { role: CheckRole } }
  | { type: 'peers'; data: PeerState }
  | { type: 'check.command' | 'check.received'; data: { id: string } }
  | { type: 'error'; data: { message: string } };

export const CHECK_SOCKET_PATH = '/lab-ws';
export const CHECK_MAX_BYTES = 4096;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, expected: string[]) {
  return Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}
function role(value: unknown): value is CheckRole {
  return value === 'console' || value === 'participant';
}
function envelope(raw: string) {
  if (raw.length > CHECK_MAX_BYTES) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || !keys(value, ['type', 'data']) || !record(value.data)) return null;
    return { type: value.type, data: value.data };
  } catch { return null; }
}
function idData(data: Record<string, unknown>): data is { id: string } {
  return keys(data, ['id']) && typeof data.id === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(data.id);
}

/** Reject unknown fields as well as wrong types before a message reaches state. */
export function parseClientMessage(raw: string): ClientMessage | null {
  const value = envelope(raw);
  if (!value) return null;
  const { type, data } = value;
  if (type === 'hello' && keys(data, ['role', 'protocolVersion']) && role(data.role) && data.protocolVersion === 1) {
    return { type, data: { role: data.role, protocolVersion: 1 } };
  }
  if ((type === 'check.send' || type === 'check.received') && idData(data)) return { type, data };
  return null;
}

export function parseServerMessage(raw: string): ServerMessage | null {
  const value = envelope(raw);
  if (!value) return null;
  const { type, data } = value;
  if (type === 'ready' && keys(data, ['role']) && role(data.role)) return { type, data: { role: data.role } };
  if (type === 'peers' && keys(data, ['console', 'participant']) && typeof data.console === 'boolean' && typeof data.participant === 'boolean') {
    return { type, data: { console: data.console, participant: data.participant } };
  }
  if ((type === 'check.command' || type === 'check.received') && idData(data)) return { type, data };
  if (type === 'error' && keys(data, ['message']) && typeof data.message === 'string' && data.message.length <= 240) {
    return { type, data: { message: data.message } };
  }
  return null;
}
