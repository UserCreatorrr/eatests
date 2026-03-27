/** @type {import('next').NextConfig} */
const nextConfig = {
  // Expose SUPABASE_URL as a server-only runtime variable
  // (does not get baked into the client bundle)
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL,
  },
}

module.exports = nextConfig
