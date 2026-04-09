const storageKey = "sars_session_v1";
const apiBaseUrlKey = "sars_api_base_url";

export const config = {
  baseUrl: localStorage.getItem(apiBaseUrlKey) || "https://attendance.test",
};
let pendingRequests = 0;

function notifyLoadingChange() {
  window.dispatchEvent(new CustomEvent("sars:loading", { detail: { pending: pendingRequests } }));
}

/** First field error from Laravel-style JSON, else `message`, else fallback. */
function messageFromApiErrorBody(data, fallback = "Request failed") {
  if (!data || typeof data !== "object") return fallback;
  const errs = data.errors;
  if (errs && typeof errs === "object" && !Array.isArray(errs)) {
    for (const key of Object.keys(errs)) {
      const val = errs[key];
      if (Array.isArray(val) && val.length && typeof val[0] === "string") return val[0];
      if (typeof val === "string" && val.trim()) return val;
    }
  }
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  return fallback;
}

export function getSession() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(payload) {
  localStorage.setItem(storageKey, JSON.stringify(payload));
}

export function clearSession() {
  localStorage.removeItem(storageKey);
}

export function setApiBaseUrl(url) {
  const next = String(url || "").trim().replace(/\/+$/, "");
  if (!next) return;
  localStorage.setItem(apiBaseUrlKey, next);
  config.baseUrl = next;
}

export async function api(path, options = {}) {
  const session = getSession();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    ...(options.headers || {}),
  };
  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  pendingRequests += 1;
  notifyLoadingChange();
  try {
    let response;
    try {
      response = await fetch(`${config.baseUrl}${path}`, {
        ...options,
        headers,
      });
    } catch {
      throw new Error(`Cannot connect to API at ${config.baseUrl}. Start backend server and check API URL.`);
    }

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      if (response.status === 401) {
        clearSession();
        window.dispatchEvent(new CustomEvent("sars:unauthorized"));
      }
      const message = isJson ? messageFromApiErrorBody(data) : "Request failed";
      const err = new Error(message);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } finally {
    pendingRequests = Math.max(0, pendingRequests - 1);
    notifyLoadingChange();
  }
}

export async function download(path, filename) {
  const session = getSession();
  const headers = {};
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  pendingRequests += 1;
  notifyLoadingChange();
  try {
    let response;
    try {
      response = await fetch(`${config.baseUrl}${path}`, { headers });
    } catch {
      throw new Error(`Cannot connect to API at ${config.baseUrl}.`);
    }
    if (!response.ok) {
      if (response.status === 401) {
        clearSession();
        window.dispatchEvent(new CustomEvent("sars:unauthorized"));
      }
      const ct = response.headers.get("content-type") || "";
      let msg = "Unable to download file.";
      if (ct.includes("application/json")) {
        try {
          const json = await response.json();
          msg = messageFromApiErrorBody(json, msg);
        } catch {
          /* keep default */
        }
      }
      throw new Error(msg);
    }

    const blob = await response.blob();
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } finally {
    pendingRequests = Math.max(0, pendingRequests - 1);
    notifyLoadingChange();
  }
}
