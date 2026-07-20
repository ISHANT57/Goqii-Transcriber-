import withSerwistInit from "@serwist/next";
import fs from "fs";
import path from "path";

try {
  const fileToDelete = path.join(process.cwd(), "public", "icon.svg");
  if (fs.existsSync(fileToDelete)) {
    fs.unlinkSync(fileToDelete);
    console.log("Deleted conflicting public/icon.svg");
  }
} catch (e) {
  // ignore
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@gooqi/shared"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
