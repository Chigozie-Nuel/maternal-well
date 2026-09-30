/**
 * API access. In the browser build the API is same-origin (`/api`, proxied by Vite in dev).
 * Android can be pointed at a facility HTTPS server at first sign-in. An optional
 * VITE_API_BASE supplies a build-time default. Browser builds use same-origin.
 */
const DEFAULT_API_BASE = (import.meta.env?.VITE_API_BASE || '').replace(/\/$/, '');
const STORAGE_KEY = 'maternawell_api_base';
export const getApiBase = () => {
  try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_API_BASE; }
  catch { return DEFAULT_API_BASE; }
};
export function setApiBase(value) {
  const trimmed = value.trim().replace(/\/$/, '');
  if (trimmed) {
    let url;
    try { url = new URL(trimmed); } catch { throw new Error('Enter a complete HTTPS sync server URL.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('The sync server must use HTTPS and cannot contain credentials or a query.');
  }
  localStorage.setItem(STORAGE_KEY, trimmed);
  return trimmed;
}

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
  const base = getApiBase();
  if (import.meta.env?.PROD && base && !base.startsWith('https://')) throw new Error('Production synchronization requires an HTTPS API URL.');
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
    response = await fetch(`${base}${path}`, {
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
