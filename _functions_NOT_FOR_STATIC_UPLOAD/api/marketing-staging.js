import { handleMarketingRequest, isMarketingPath } from "./marketing.js";

const STATIC_PATHS = new Set([
  "/admin-marketing",
  "/admin-marketing.html",
  "/admin/marketing.html",
  "/admin/marketing.css",
  "/admin/marketing.js",
  "/admin/legacy-redirect.js",
  "/styles.css",
  "/logo.png",
  "/favicon.ico",
]);

function stagingEnv(env) {
  return { ...env, MARKETING_PUBLISHING_DISABLED: "true" };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const effectiveEnv = stagingEnv(env);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        environment: "marketing-staging",
        publishingDisabled: true,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    if (isMarketingPath(url.pathname)) {
      return handleMarketingRequest(request, effectiveEnv, url);
    }

    if (url.pathname === "/") {
      return Response.redirect(new URL("/admin/marketing.html", url), 302);
    }

    if (STATIC_PATHS.has(url.pathname) && env.ASSETS?.fetch) {
      return env.ASSETS.fetch(request);
    }

    return Response.json({ ok: false, error: "Not found." }, { status: 404 });
  },
};
