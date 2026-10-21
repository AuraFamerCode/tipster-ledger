/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The MemWal SDK and its Sui/Seal deps are server-only; keep them out of the client bundle.
  serverExternalPackages: ["@mysten-incubation/memwal", "@mysten/sui", "@mysten/seal"],
};
export default nextConfig;
