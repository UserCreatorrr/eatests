/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  // v2: los errores de tipos paran el build. Antes se ignoraban y llegaban a producción.
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
