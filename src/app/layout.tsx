import type { Metadata } from "next";
import Link from "next/link";
import { PwaRegistration } from "@/components/pwa-registration";
import { AuthControls } from "@/components/auth-controls";
import "./globals.css";

export const metadata: Metadata = {
  title: "BannBonus | ช่างออนไลน์",
  description: "ประสานงานช่างรับเหมาอิสระ รับงานใหม่ 10:00–02:00 น. Booking ล่วงหน้าฟรี รอเจ้าหน้าที่อนุมัติก่อนยืนยันนัด",
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>
        <PwaRegistration />
        <header className="site-header">
          <nav className="site-nav" aria-label="เมนูหลัก">
            <Link className="brand" href="/">BannBonus</Link>
            <div className="nav-links">
              <Link href="/booking">Booking</Link>
              <Link href="/pricing">ค่าบริการ</Link>
              <Link href="/my-bookings">คำขอของฉัน</Link>
              <Link href="/staff">ทีมงาน</Link>
              <AuthControls />
            </div>
          </nav>
        </header>
        <div className="site-main">{children}</div>
        <footer className="site-footer">
          ช่างรับเหมาอิสระ · รับงานใหม่ 10:00–02:00 น. · Booking ล่วงหน้าฟรี รอเจ้าหน้าที่อนุมัติ
        </footer>
      </body>
    </html>
  );
}
