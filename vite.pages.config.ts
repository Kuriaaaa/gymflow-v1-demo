import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "gymflow-v1-demo";

// The production bundle is a module script plus a stylesheet, both served from
// the same origin, so no inline scripts or styles are allowed. React applies
// `style` props through the CSSOM, which style-src does not restrict.
// Only injected into the build: the dev server needs an inline React Refresh preamble.
export const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

function contentSecurityPolicyMeta(): Plugin {
  return {
    name: "gymflow-csp-meta",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const charset = '<meta charset="UTF-8" />';
        if (!html.includes(charset)) throw new Error("index.html must declare <meta charset=\"UTF-8\" /> for the CSP meta tag");
        // Placed straight after the charset declaration, before any script or stylesheet.
        return html.replace(charset, `${charset}\n    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}" />`);
      },
    },
  };
}

export default defineConfig({
  base: `/${repositoryName}/`,
  plugins: [react(), contentSecurityPolicyMeta()],
  build: {
    outDir: "dist-pages",
    emptyOutDir: true,
  },
});
