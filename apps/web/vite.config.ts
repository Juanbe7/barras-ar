import { defineConfig } from "vite";

export default defineConfig({
  // the camera only works on HTTPS or localhost; `--host` exposes the dev server to a phone on the same network
  server: { port: 5173 },
});
