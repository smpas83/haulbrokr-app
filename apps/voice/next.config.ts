import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kip/ui", "@kip/voice", "@kip/workflows"]
};

export default nextConfig;
