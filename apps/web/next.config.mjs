import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/shared"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  serverExternalPackages: ["jose", "googleapis"],
};

export default nextConfig;
