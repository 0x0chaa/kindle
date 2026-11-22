import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // solc-js ships a large compiler build; load it from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["solc"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@react-three/drei"],
  },
};

export default nextConfig;
