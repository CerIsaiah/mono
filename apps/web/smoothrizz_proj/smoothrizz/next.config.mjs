/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        has: [
          {
            type: 'host',
            value: 'www.smoothrizz.com',
          },
        ],
        destination: 'https://smoothrizz.com',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.smoothrizz.com',
          },
        ],
        destination: 'https://smoothrizz.com/:path*',
        permanent: true,
      },
    ]
  },
  trailingSlash: false,
};

export default nextConfig;
