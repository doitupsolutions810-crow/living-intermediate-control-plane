/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Vercel-ready; keep API routes dynamic for platform proxies
  experimental: {
    // leave empty — App Router defaults are enough for this surface
  }
};

export default nextConfig;
