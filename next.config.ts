import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    serverActions: { bodySizeLimit: '500mb' },
  },
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg", "fluent-ffmpeg"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;