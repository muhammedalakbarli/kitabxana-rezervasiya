import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel öz build sistemini istifadə edir; standalone yalnız Docker/öz server üçün
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  devIndicators: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" }, // Vercel funksiyalarında sorğu limiti 4.5 MB
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
