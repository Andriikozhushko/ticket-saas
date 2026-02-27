import type { NextConfig } from "next";

if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY?.trim()) {
  throw new Error("NEXT_PUBLIC_TURNSTILE_SITEKEY is required for production builds");
}

const nextConfig: NextConfig = {
  transpilePackages: ["html5-qrcode"],
  output: "standalone",
  typescript: { ignoreBuildErrors: true }, // TODO: remove when type errors fixed
};

export default nextConfig;
