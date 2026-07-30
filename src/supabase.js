export const SUPABASE_URL = 'https://klyjygzrdqbvndbrcsvn.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_14CEjkdZKIMziSsPdQzrDg_UQnzeYer';

const headers = token => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${token || SUPABASE_KEY}`,
  'Content-Type': 'application/json'
});

async function request(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { ...headers(options.token), ...options.headers }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const dbSelect = (table, query, token) =>
  request(`/rest/v1/${table}?${query}`, { token });

export const dbInsert = (table, values, token) =>
  request(`/rest/v1/${table}`, {
    method: 'POST',
    token,
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(values)
  });

export const dbUpdate = (table, id, values, token) =>
  request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(values)
  });

export const dbDelete = (table, id, token) =>
  request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token
  });

export const signInAdmin = (email, password) =>
  request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
