import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local network IPs to access Next.js dev resources
  // This enables phone access via the laptop's local IP
  allowedDevOrigins: [
    "http://10.162.106.118:3000",
    "http://192.168.14.40:3000",
    "http://localhost:3000",
    "http://10.153.12.27:3000",
    "http://10.244.77.92:3000",
    "10.162.106.118",
    "192.168.14.40",
    "localhost",
    "10.153.12.27",
    "10.244.77.92",
  ] as any,
};

export default nextConfig;
