// All requests go to /api on the same site (Vite proxy in dev, Netlify proxy in production),
// so the httpOnly login cookie is sent automatically.
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    // not JSON (for example the API is asleep or unreachable)
  }
  if (!res.ok) {
    if (res.status === 403 && !path.startsWith('/auth')) window.dispatchEvent(new Event('auth:changed'));
    throw new ApiError(res.status, data?.error || 'Could not reach the server. Please try again.');
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};

export const photoUrl = (player) =>
  player?.hasPhoto ? `/api/players/${player.id ?? player.playerId}/photo?v=${player.version}` : null;
