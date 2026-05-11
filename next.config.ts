import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Allow local network IPs to access Next.js dev resources
  // Replace or add your phone's IP address if it changes
  allowedDevOrigins: [
    "http://10.162.106.118:3000",
    "http://192.168.14.40:3000",
    "http://localhost:3000",
    "10.162.106.118",
    "192.168.14.40",
    "localhost"
  ] as any, // use as any to suppress TypeScript error if type is missing in this version
};

export default nextConfig;
