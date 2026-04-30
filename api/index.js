/*
  _._     _,-'""`-._                     
 (,-.`._,'(       |\`-/|   Funny proxy!
    `-.-' \ )-`( , o o)  — unrelated shenanigans added
      `-    \`_`"-`_/-'   No unicorns were harmed.
*/
export const config = { runtime: "edge" };

// Environment-backed destination (trim trailing slash)
const DESTINATION_ROOT = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");
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

    const pathStart = req.url.indexOf("/", 8);
    const forwardUrl =
      pathStart === -1 ? DESTINATION_ROOT + "/" : DESTINATION_ROOT + req.url.slice(pathStart);

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
