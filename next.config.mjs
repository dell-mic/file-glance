/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  experimental: {
    reactCompiler: true,
  },
  devIndicators: {
    appIsrStatus: false,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // Probably wait until: https://github.com/creativetimofficial/material-tailwind/issues/593
    ignoreBuildErrors: true,
  },
}

export default nextConfig
