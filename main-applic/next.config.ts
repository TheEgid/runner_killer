import os from "os";
import type { NextConfig } from "next";

const isLinux = os.platform() === "linux";

const nextConfig: NextConfig = {
    experimental: {
        webpackBuildWorker: true,
        esmExternals: true,
    },
    reactStrictMode: true,
    distDir: "build",
    onDemandEntries: { maxInactiveAge: 25 * 10000 },
    devIndicators: false,
    transpilePackages: [
        "rehype",
    ],

    basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
    assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",

    ...(isLinux && {
        trailingSlash: false,
    }),
};

export default nextConfig;
