import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gooqi Scribe",
    short_name: "Gooqi",
    description: "Your AI-powered medical documentation assistant",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a", // slate-900
    theme_color: "#0f172a",
    icons: [
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "maskable"
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    screenshots: [
      {
        src: "/screenshot-desktop.svg.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide"
      } as any,
      {
        src: "/screenshot-mobile.svg.png",
        sizes: "720x1280",
        type: "image/png",
        form_factor: "narrow"
      } as any
    ]
  };
}
