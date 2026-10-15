import type { Metadata } from "next";
import Link from "next/link";
import { PwaRegistration } from "@/components/pwa-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "BannBonus | ช่างออนไลน์",
  description: "ส่งคำขอบริการช่างในกรุงเทพฯ และนนทบุรี ทีมงานตรวจสอบและยืนยันการจองก่อนให้บริการ",
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
              <Link href="/booking">แจ้งซ่อม</Link>
              <Link href="/my-bookings">คำขอของฉัน</Link>
              <Link href="/staff">ทีมงาน</Link>
              <Link href="/login">เข้าสู่ระบบ</Link>
            </div>
          </nav>
        </header>
        <div className="site-main">{children}</div>
        <footer className="site-footer">
          รับคำขอได้ตลอด 24 ชั่วโมง · กรุงเทพฯ และนนทบุรี · การนัดหมายต้องรอทีมงานยืนยัน
        </footer>
      </body>
    </html>
  );
}
