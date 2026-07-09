import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gooqi Scribe",
    short_name: "Gooqi",
    description: "Your AI-powered medical documentation assistant",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a", // slate-900
    theme_color: "#0f172a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
