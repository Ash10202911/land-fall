import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CargoTribe",
    short_name: "CargoTribe",
    description: "Sealed freight quotes for overseas agents and ANZ forwarders.",
    start_url: "/jobs",
    display: "standalone",
    background_color: "#f5f7fa",
    theme_color: "#0c5a9c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
