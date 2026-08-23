/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  // The `typescript` dependency is aliased to @typescript/typescript6 (API-only
  // build, bin is `tsc6`). Next 16.3 defaults useTypeScriptCli to true, which
  // requires `typescript/bin/tsc`; force API mode (`lib/typescript.js`) instead.
  experimental: {
    useTypeScriptCli: false,
  },
}

export default nextConfig
