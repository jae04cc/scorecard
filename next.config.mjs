/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // src/instrumentation.ts (DB migrations at server startup) runs without a flag since Next 15.
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
