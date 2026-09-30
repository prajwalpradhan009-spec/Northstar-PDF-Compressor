/**
 * Thin fetch wrapper for the NorthStar API.
 *
 * The auth session lives in an HttpOnly cookie the browser attaches
 * automatically, so nothing here reads, writes or sends a token — and
 * `credentials: 'include'` keeps the cookie flowing cross-origin too.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  constructor(message, { status, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status ?? 0;
    this.details = details || null;
  }
}

function buildUrl(path) {
  return `${API_BASE}${path}`;
}

async function parse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request(path, { method = 'GET', body, signal, headers } = {}) {
  let response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      credentials: 'include',
      headers: {
        ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach the server. Make sure the backend is running, then try again.');
  }

  const data = await parse(response);

  if (!response.ok) {
    throw new ApiError(data?.error || `Request failed (${response.status}).`, {
      status: response.status,
      details: data?.details,
    });
  }
  return data;
}

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

export const auth = {
  me: (signal) => request('/api/auth/me', { signal }),
  signup: (payload) => request('/api/auth/signup', { method: 'POST', body: payload }),
  signin: (payload) => request('/api/auth/signin', { method: 'POST', body: payload }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  logoutAll: () => request('/api/auth/logout-all', { method: 'POST' }),
  updateProfile: (payload) => request('/api/auth/me', { method: 'PATCH', body: payload }),
  dashboard: (signal) => request('/api/dashboard', { signal }),
};

/* ------------------------------------------------------------------ *
 * PDF
 * ------------------------------------------------------------------ */

/** Inspect uploads to read real page counts for the file cards. */
export const pdf = {
  inspect: (formData, signal) => request('/api/pdf/inspect', { method: 'POST', body: formData, signal }),
  /**
   * Merge and return the PDF as a Blob so the caller can trigger the download
   * and read the page count from the response headers.
   */
  merge: async (formData, signal) => {
    let response;
    try {
      response = await fetch(buildUrl('/api/pdf/merge'), {
        method: 'POST',
        credentials: 'include',
        body: formData,
        signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new ApiError('Cannot reach the server. Make sure the backend is running, then try again.');
    }

    if (!response.ok) {
      const data = await parse(response);
      throw new ApiError(data?.error || `Merge failed (${response.status}).`, { status: response.status });
    }

    const disposition = response.headers.get('Content-Disposition') || '';
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    const plain = /filename="([^"]+)"/i.exec(disposition);
    const name = encoded ? decodeURIComponent(encoded[1]) : plain ? plain[1] : 'northstar_merged.pdf';

    return {
      blob: await response.blob(),
      name,
      pageCount: Number(response.headers.get('X-Page-Count')) || null,
      sourceCount: Number(response.headers.get('X-Source-Count')) || null,
    };
  },
};

/* ------------------------------------------------------------------ *
 * Images
 * ------------------------------------------------------------------ */

export const images = {
  limits: (signal) => request('/api/image/limits', { signal }),
  compress: (formData, signal) => request('/api/image/compress', { method: 'POST', body: formData, signal }),

  /** Stream a ZIP of every compressed image straight to a download. */
  compressAndZip: async (formData, signal) => {
    let response;
    try {
      response = await fetch(buildUrl('/api/image/compress-and-zip'), {
        method: 'POST',
        credentials: 'include',
        body: formData,
        signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new ApiError('Cannot reach the server. Make sure the backend is running, then try again.');
    }

    if (!response.ok) {
      const data = await parse(response);
      throw new ApiError(data?.error || `Compression failed (${response.status}).`, { status: response.status });
    }

    const disposition = response.headers.get('Content-Disposition') || '';
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    const plain = /filename="([^"]+)"/i.exec(disposition);
    const name = encoded ? decodeURIComponent(encoded[1]) : plain ? plain[1] : 'northstar_compressed_images.zip';

    return { blob: await response.blob(), name };
  },
};
