import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "ช่างเดย์เนรมิต | Day Neramit", short_name: "Day Neramit",
    description: "เรียกช่างทันทีตามสถานะ 10:00–02:00 น. จองล่วงหน้าได้ 24 ชั่วโมง",
    lang: "th", start_url: "/", scope: "/", display: "standalone",
    background_color: "#070908", theme_color: "#e7bb5e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
