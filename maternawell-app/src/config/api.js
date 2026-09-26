/**
 * API access. In the browser build the API is same-origin (`/api`, proxied by Vite in dev).
 * The Android build sets VITE_API_BASE to the facility sync server, e.g. https://sync.example.ng
 */
export const API_BASE = (import.meta.env?.VITE_API_BASE || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export class NetworkError extends Error {}

async function gzip(text) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return await new Response(stream).arrayBuffer();
  } catch {
    return null;
  }
}

export async function apiRequest(path, { token, body, method, compress = false, timeoutMs = 20000 } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    if (compress && payload.length > 1024) {
      const zipped = await gzip(payload);
      if (zipped) {
        payload = zipped;
        headers['Content-Encoding'] = 'gzip';
      }
    }
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: method || (body !== undefined ? 'POST' : 'GET'),
      headers,
      body: payload,
      signal: controller?.signal
    });
  } catch (error) {
    throw new NetworkError(error?.message || 'Network unavailable');
  } finally {
    if (timer) clearTimeout(timer);
  }
  let data = null;
  try { data = await response.json(); } catch { /* empty body */ }
  if (!response.ok) throw new ApiError(response.status, data?.error || `Request failed (${response.status})`);
  return data;
}
