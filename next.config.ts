import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tell Next.js not to bundle @xenova/transformers — let Node.js handle it
  // natively. The package uses native binaries and dynamic model loading that
  // are incompatible with webpack bundling.
  serverExternalPackages: ["@xenova/transformers"],
};

export default nextConfig;
