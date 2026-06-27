/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module — keep it external to the server bundle.
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  // The kernel + policy are pure-TS workspace packages; transpile their source so
  // the Workbench API route can compile and run user workflows server-side.
  transpilePackages: ["@ring-zero/kernel", "@ring-zero/policy"],
  webpack: (config) => {
    // The workspace packages use ESM ".js" specifiers that resolve to ".ts" source.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
