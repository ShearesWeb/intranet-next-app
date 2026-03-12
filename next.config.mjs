/** @type {import('next').NextConfig} */
const nextConfig = {
    // output: 'export',
    /* config options here */
    eslint: {
        ignoreDuringBuilds: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'deifkwefumgah.cloudfront.net',
            },
        ],
    },
};

export default nextConfig;
