/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Enable linting during builds to ensure code quality
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
