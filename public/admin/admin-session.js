const CORE_TOKEN_KEY = "bingoAdminCoreToken";
const LEGACY_TOKEN_KEY = "bingoAdminGiftCardToken";

export function adminToken(storage = sessionStorage) {
  return storage.getItem(CORE_TOKEN_KEY) || storage.getItem(LEGACY_TOKEN_KEY) || "";
}

export function adminHeaders(storage = sessionStorage) {
  return { Authorization:`Bearer ${adminToken(storage)}`, "Content-Type":"application/json", Accept:"application/json" };
}

export function clearAdminSession(storage = sessionStorage) {
  storage.removeItem(CORE_TOKEN_KEY);
  storage.removeItem(LEGACY_TOKEN_KEY);
}

export async function authenticatedAdminRequest(fetcher, storage, url, options = {}, onLocked = () => {}) {
  if (!adminToken(storage)) {
    onLocked();
    throw new Error("Admin session is locked.");
  }
  const response = await fetcher(url, { ...options, headers:{ ...adminHeaders(storage), ...(options.headers || {}) } });
  if (response.status === 401) {
    clearAdminSession(storage);
    onLocked();
    throw new Error("Admin session expired. Unlock the centre to continue.");
  }
  return response;
}
