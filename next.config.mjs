/** @type {import('next').NextConfig} */

// Encabezados de seguridad fijos (Fase 2.2). La Content-Security-Policy lleva un
// nonce por request y por eso se arma en src/middleware.ts.
const encabezadosSeguridad = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  // Sin next/image: no se usa, y el optimizador de imágenes es el componente
  // de Next.js con más fallas críticas publicadas. Si algún día se usa, revisar antes.
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: encabezadosSeguridad }];
  },
};

export default nextConfig;
