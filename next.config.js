/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'pdf-lib', '@prisma/client'],
  },
};

module.exports = nextConfig;
