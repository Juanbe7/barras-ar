const DEFAULT_API_URL = "http://localhost:3000";

export const config = {
  apiUrl: String(import.meta.env.VITE_API_URL ?? DEFAULT_API_URL).replace(/\/$/, ""),
};
