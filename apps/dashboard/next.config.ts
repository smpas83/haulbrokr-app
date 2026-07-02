import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@kip/ui",
    "@kip/workflows",
    "@kip/company-haulbrokr",
    "@kip/company-merchnow",
    "@kip/company-gwfg",
    "@kip/company-stratus",
    "@kip/company-personal"
  ]
};

export default nextConfig;
