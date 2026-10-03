import type { NextConfig } from "next";

// Static export → out/, served by a Cloudflare Worker (wrangler.jsonc).
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
