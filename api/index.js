/*
  _._     _,-'""`-._                     
 (,-.`._,'(       |\`-/|   Funny proxy!
    `-.-' \ )-`( , o o)  — unrelated shenanigans added
      `-    \`_`"-`_/-'   No unicorns were harmed.
*/
export const config = { runtime: "edge" };

// Environment-backed destination (trim trailing slash)
const DESTINATION_ROOT = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");
// Optional mapping of short keys -> allowed destination roots.
// Set `PROXY_MAP` to a JSON string in env, e.g.
// {"do":"https://example.com","next":"https://nextjs.org","react":"https://react.dev"}
let PROXY_MAP = {};
try {
  if (process.env.PROXY_MAP) {
    PROXY_MAP = JSON.parse(process.env.PROXY_MAP);
  }
} catch (e) {
  console.warn("Invalid PROXY_MAP environment variable; ignoring it.");
  PROXY_MAP = {};
}
// Playground page used for testing only
const MAGIC_PAGE = "/funtime.html";

// Headers we aggressively drop when proxying
const OMIT_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function gateway(req) {
  if (!DESTINATION_ROOT) {
    return new Response("🎩 Hat's empty — no destination configured.", { status: 500 });
  }

  try {
    console.log("🚀 Gateway forwarding to:", DESTINATION_ROOT);

    const incomingUrl = new URL(req.url);
    // Expect path format: /proxy/{key}/{rest-of-path}
    const parts = incomingUrl.pathname.split("/").filter(Boolean);
    // parts[0] should be 'proxy' since this handler is mounted at /api/index and Vercel rewrites /proxy/* -> /api/index
    // The next segment is the key we use to look up the allowed destination
    let key = null;
    if (parts.length >= 2 && parts[0] === "proxy") {
      key = parts[1];
    } else if (parts.length >= 1 && parts[0] === "proxy") {
      // /proxy with nothing after it
      key = null;
    }

    let targetRoot = null;
    if (key && PROXY_MAP[key]) {
      targetRoot = PROXY_MAP[key].replace(/\/$/, "");
    } else if (DESTINATION_ROOT) {
      // fallback: if a single DESTINATION_ROOT is configured and no mapping matches, use it
      targetRoot = DESTINATION_ROOT;
    }

    if (!targetRoot) {
      return new Response("🚫 Proxy target not allowed or not configured.", { status: 403 });
    }

    const restPath = (parts.length > 2) ? "/" + parts.slice(2).join("/") : "/";
    const forwardUrl = `${targetRoot}${restPath}${incomingUrl.search}`;

    const outgoing = new Headers();
    let seenIp = null;

    for (const [name, value] of req.headers) {
      const lower = name.toLowerCase();
      if (OMIT_HEADERS.has(lower)) continue;
      if (lower.startsWith("x-vercel-")) continue;
      if (lower === "x-real-ip") {
        seenIp = value;
        continue;
      }
      if (lower === "x-forwarded-for") {
        if (!seenIp) seenIp = value;
        continue;
      }
      outgoing.set(name, value);
    }

    if (seenIp) outgoing.set("x-forwarded-for", seenIp);

    const verb = req.method;
    const hasPayload = verb !== "GET" && verb !== "HEAD";

    return await fetch(forwardUrl, {
      method: verb,
      headers: outgoing,
      body: hasPayload ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch (error) {
    console.error("gateway-error:", error);
    return new Response("💥 Whoops — proxy hiccup occurred.", { status: 502 });
  }
}
