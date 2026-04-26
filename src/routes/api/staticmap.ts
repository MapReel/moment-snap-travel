import { createFileRoute } from "@tanstack/react-router";

// Proxies Google Static Maps so the API key never reaches the browser.
// Usage: /api/staticmap?lat=35.7148&lng=139.7967&zoom=16&w=360&h=110
export const Route = createFileRoute("/api/staticmap")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = process.env.GOOGLE_MAPS_API_KEY;
        if (!key) {
          return new Response("GOOGLE_MAPS_API_KEY not configured", { status: 500 });
        }
        const url = new URL(request.url);
        const lat = parseFloat(url.searchParams.get("lat") ?? "");
        const lng = parseFloat(url.searchParams.get("lng") ?? "");
        const zoom = Math.min(20, Math.max(1, parseInt(url.searchParams.get("zoom") ?? "16", 10)));
        const w = Math.min(640, Math.max(64, parseInt(url.searchParams.get("w") ?? "360", 10)));
        const h = Math.min(640, Math.max(64, parseInt(url.searchParams.get("h") ?? "110", 10)));
        const scale = url.searchParams.get("scale") === "2" ? 2 : 1;

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return new Response("Invalid lat/lng", { status: 400 });
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return new Response("Out of range lat/lng", { status: 400 });
        }

        const params = new URLSearchParams({
          center: `${lat},${lng}`,
          zoom: String(zoom),
          size: `${w}x${h}`,
          scale: String(scale),
          maptype: "roadmap",
          markers: `color:red|${lat},${lng}`,
          key,
        });
        const upstream = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`);
        if (!upstream.ok) {
          const txt = await upstream.text();
          console.error("staticmap upstream failed", upstream.status, txt);
          return new Response("Map upstream error", { status: 502 });
        }
        const buf = await upstream.arrayBuffer();
        return new Response(buf, {
          status: 200,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "image/png",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
