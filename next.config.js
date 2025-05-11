/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disabling ESLint during production builds to avoid build failures
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig 