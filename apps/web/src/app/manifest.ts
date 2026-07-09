import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gooqi Scribe",
    short_name: "Gooqi",
    description: "Your AI-powered medical documentation assistant",
    id: "/?source=pwa",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a", // slate-900
    theme_color: "#0f172a",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      },
    ],
    screenshots: [
      {
        src: "/screenshot-desktop.svg.png",
        sizes: "2752x1536",
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
