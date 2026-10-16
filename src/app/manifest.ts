import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "BannBonus ช่างออนไลน์", short_name: "BannBonus",
    description: "ส่งคำขอบริการและติดตามสถานะ ทุกนัดหมายรอทีมงานยืนยัน",
    lang: "th", start_url: "/", scope: "/", display: "standalone",
    background_color: "#f7f9fc", theme_color: "#13243a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
