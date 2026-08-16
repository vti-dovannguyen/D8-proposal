import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions cap request bodies at 1MB by default, which rejects file
    // uploads (documents/attachments) before they reach the action. Match the
    // storage layer's 50MB ceiling (see MAX_BYTES in src/lib/storage.ts).
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  allowedDevOrigins: ['f97d-118-70-129-169.ngrok-free.app'],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
