// In production, nginx proxies /observations and /health to the API.
// In local dev, point VITE_API_URL at your local API (e.g. http://localhost:8100).
export const API = import.meta.env.VITE_API_URL ?? "";
