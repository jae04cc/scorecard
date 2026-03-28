/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    // Runs src/instrumentation.ts at server startup (used for DB migrations)
    instrumentationHook: true,
    serverComponentsExternalPackages: ["@libsql/client"],
  },
};

export default nextConfig;
