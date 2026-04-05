import { API } from "../config";

/**
 * Build an instance-prefixed API URL
 * @param instanceKey - Instance key (e.g., "hot-takes")
 * @param path - API path (e.g., "/observations")
 * @returns Full URL with instance prefix (e.g., "http://api/hot-takes/observations")
 */
export function buildInstanceUrl(instanceKey: string, path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // Build URL: API_BASE/instance_key/path
  return `${API}/${instanceKey}${normalizedPath}`;
}

/**
 * Get auth headers for API requests
 */
export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("sm_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
