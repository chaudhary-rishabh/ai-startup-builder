import type { NextConfig } from 'next'

const remotePatterns: NonNullable<NextConfig['images']>['remotePatterns'] = [
  {
    protocol: 'https',
    hostname: 'lh3.googleusercontent.com',
  },
]

if (process.env.NEXT_PUBLIC_S3_BUCKET_HOSTNAME) {
  remotePatterns.push({
    protocol: 'https',
    hostname: process.env.NEXT_PUBLIC_S3_BUCKET_HOSTNAME,
  })
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self'",
              `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL ?? ''}`,
              "frame-src 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
}

export default nextConfig
