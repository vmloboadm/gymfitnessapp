/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/app",
  output: "standalone",
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "encrypted-tbn0.gstatic.com" },
      { protocol: "https", hostname: "**.gstatic.com" },
      { protocol: "https", hostname: "jeixbpucnxrhizqpapyv.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
