import { dirname } from "path";
import { fileURLToPath } from "url";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
	outputFileTracingRoot: __dirname,
	// output: 'export',
	/* config options here */
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "deifkwefumgah.cloudfront.net",
			},
		],
	},
	async redirects() {
		return [
			{
				source: "/dashboard/ccaAllocation/:path*",
				destination: "/dashboard/cca-allocation/:path*",
				permanent: true,
			},
			{
				source: "/dashboard/holidaySubsidy/:path*",
				destination: "/dashboard/holiday-subsidy/:path*",
				permanent: true,
			},
			{
				source: "/dashboard/mycca/:path*",
				destination: "/dashboard/my-cca/:path*",
				permanent: true,
			},
		];
	},
};

export default nextConfig;

// Enables Cloudflare bindings (getCloudflareContext) during `next dev`. No-op in prod.
initOpenNextCloudflareForDev();
