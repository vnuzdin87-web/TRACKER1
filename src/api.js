export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  const init = {
    method,
    credentials: 'same-origin',
    headers: requestHeaders,
  };

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response;

  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(
      'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.',
      0,
    );
  }

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && typeof data.message === 'string'
        ? data.message
        : 'Не удалось выполнить запрос. Попробуйте ещё раз.';

    throw new ApiError(message, response.status, data);
  }

  return data;
}

function toQuery(params = {}) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export function submitResponse(payload) {
  return request('/api/responses', {
    method: 'POST',
    body: payload,
  });
}

export function loginAdmin(credentials) {
  return request('/api/auth/login', {
    method: 'POST',
    body: credentials,
  });
}

export function logoutAdmin() {
  return request('/api/auth/logout', { method: 'POST' });
}

export function getMe() {
  return request('/api/auth/me');
}

export function getStats() {
  return request('/api/admin/stats');
}

export function getResponses(params = {}) {
  return request(`/api/admin/responses${toQuery(params)}`);
}

export function deleteAllResponses() {
  return request('/api/admin/responses', {
    method: 'DELETE',
    body: { confirm: true },
  });
}

export function getAdmins() {
  return request('/api/admin/admins');
}

export function createAdmin(payload) {
  return request('/api/admin/admins', {
    method: 'POST',
    body: payload,
  });
}

export function updateAdmin(id, payload) {
  return request(`/api/admin/admins/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function buildExportUrl(filters = {}) {
  return `/api/admin/export.csv${toQuery(filters)}`;
}
