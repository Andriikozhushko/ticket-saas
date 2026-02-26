import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["html5-qrcode"],
  output: "standalone",
  typescript: { ignoreBuildErrors: true }, // TODO: remove when type errors fixed
};

export default nextConfig;
