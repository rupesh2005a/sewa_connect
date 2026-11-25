import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: [
        "index.html",
        "auth.html",
        "profile.html",
        "provider-auth.html",
        "provider-availability.html",
        "provider-dashboard.html",
        "provider-services.html",
        "sewa.html",
        "transport-provider.html",
        "transport-results.html",
        "transport.html",
      ],
    },
  },
  server: {
    open: "/sewa.html",
  },
});
