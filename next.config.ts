import type { NextConfig } from "next";

const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isGithubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  // Dev-only origin allowlist
  allowedDevOrigins: ["192.168.1.5", "172.17.0.1"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.ygoprodeck.com",
      },
    ],
    // Required for static export / GitHub Pages
    unoptimized: true,
  },

  ...(isGithubPages
    ? {
        output: "export",
        trailingSlash: true,
        basePath: repo ? `/${repo}` : "",
        assetPrefix: repo ? `/${repo}/` : undefined,
      }
    : {}),
};

export default nextConfig;
