import type { Metadata } from "next";
import Link from "next/link";
import { AuthControls } from "@/components/auth-controls";
import { PwaRegistration } from "@/components/pwa-registration";
import { Phone, ArrowUpRight } from "lucide-react";
import { dayNeramitBusiness } from "@/lib/day-neramit-business";
import { portalMode } from "@/lib/portal-mode";
import { StaffRoleGate } from "@/components/staff-role-gate";
import "./globals.css";

const staff = portalMode() === "STAFF";
export const metadata: Metadata = staff ? {
  title: { default: "BannBonus | ศูนย์จัดการงานช่างและ Admin", template: "%s | BannBonus Staff" },
  description: "ระบบงานภายในสำหรับเจ้าหน้าที่ ผู้ดูแลระบบ และทีมช่างที่ได้รับอนุญาต",
  robots: { index: false, follow: false },
} : {
  title: { default: "ช่างเดย์เนรมิตร | เรียกช่างบางใหญ่ บางบัวทอง 10:00–02:00 น.", template: "%s | Day Neramit" },
  description: "ช่างเดย์เนรมิตร ซ่อมแซม ติดตั้ง และดูแลบ้านในบางใหญ่ บางบัวทอง เรียกช่างทันทีตามสถานะพร้อมรับงาน 10:00–02:00 น. นัดหมายล่วงหน้าได้ 24 ชั่วโมง",
  robots: { index: true, follow: true },
  icons: {
    icon: "https://d2ol7oe51mr4n9.cloudfront.net/user_3Jbrjw1A1wOVLHTuEgAgHqYVg57/e7bc55fe-d06b-4d14-ae26-d75e6f59753c.jpg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({children}: Readonly<{children:React.ReactNode}>) {
  return <html lang="th"><body>
    <PwaRegistration/>
    {staff ? <>
      <div className="topbar"><div className="shell">
        <span><span className="gold-dot"/> BANNBONUS · ระบบงานช่างและผู้ดูแล</span>
        <span>ใช้เฉพาะบัญชีที่ได้รับสิทธิ์</span>
      </div></div>
      <header className="site-header"><div className="shell">
        <nav className="site-nav" aria-label="เมนูระบบงานช่าง">
          <Link className="brand" href="/"><span>BannBonus<small>STAFF · TECHNICIAN · ADMIN</small></span></Link>
          <div className="nav-links">
            <Link href="/">หน้าหลักทีมงาน</Link>
            <Link href="/operator/bookings">Admin / จัดการงาน</Link>
            <Link href="/technician/jobs">งานช่าง</Link>
            <Link href="/staff">ศูนย์รับงาน</Link>
          </div>
          <div className="header-actions"><AuthControls/></div>
        </nav>
      </div></header>
    </> : <>
      <div className="topbar"><div className="shell"><span><span className="gold-dot"/> เรียกช่าง 10:00–02:00 น. · นัดหมายได้ 24 ชั่วโมง</span><span>อำเภอบางใหญ่และอำเภอบางบัวทอง</span></div></div>
      <header className="site-header"><div className="shell"><nav className="site-nav" aria-label="เมนูหลัก">
        <Link className="brand" href="/"><img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3Jbrjw1A1wOVLHTuEgAgHqYVg57/e7bc55fe-d06b-4d14-ae26-d75e6f59753c.jpg" width="47" height="43" alt="" /><span>ช่างเดย์<b>เนรมิตร</b><small>DAY NERAMIT · SMART SERVICE</small></span></Link>
        <div className="nav-links"><Link href="/#services">บริการของเรา</Link><Link href="/booking?mode=IMMEDIATE">เรียกช่าง</Link><Link href="/booking?mode=BOOKING">นัดหมาย</Link><Link href="/my-bookings">รายการนัดหมาย</Link></div>
        <div className="header-actions"><a className="phone-link" href="tel:0924367468"><Phone size={16}/> 092-436-7468</a><AuthControls/><Link className="btn btn-gold header-cta" href="/booking">เรียกช่าง <ArrowUpRight size={16}/></Link></div>
      </nav></div></header>
    </>}
    <main className="site-main shell">{staff ? <StaffRoleGate>{children}</StaffRoleGate> : children}</main>
    {staff ? <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand"><strong>BannBonus · Team Operations</strong><p>สำหรับช่างและ Admin เท่านั้น</p></div>
        <div><strong>เมนูทีมงาน</strong><Link href="/">ศูนย์งาน</Link><Link href="/operator/bookings">Admin / จัดการงาน</Link><Link href="/technician/jobs">งานของช่าง</Link></div>
        <div><strong>เว็บไซต์ลูกค้า</strong><a href="https://chang24.vercel.app" target="_blank" rel="noopener noreferrer">chang24.vercel.app</a></div>
      </div>
      <div className="footer-bottom">© 2026 BannBonus · Internal operations · ทุกการเข้าถึงขึ้นอยู่กับสิทธิ์ในฐานข้อมูล</div>
    </footer> : <footer className="site-footer"><div className="shell footer-grid">
      <div className="footer-brand"><strong>ช่างเดย์<span>เนรมิตร</span></strong><p>SMART REPAIR &amp; RENOVATION</p><small>บริการช่างในอำเภอบางใหญ่และอำเภอบางบัวทอง</small></div>
      <div><strong>บริการ</strong><Link href="/booking">เรียกช่างและนัดหมาย</Link><Link href="/pricing">ค่าบริการ</Link><Link href="/my-bookings">ติดตามสถานะนัดหมาย</Link></div>
      <div><strong>ติดต่อ</strong><a href="tel:0924367468">092-436-7468</a><a href="https://line.me/R/ti/p/@0924367468" target="_blank" rel="noopener noreferrer">LINE @0924367468</a><p>บางใหญ่ · บางบัวทอง · นนทบุรี</p><p>สำนักงาน: {dayNeramitBusiness.officeAddress}</p><a href={dayNeramitBusiness.officeMapUrl} target="_blank" rel="noopener noreferrer">ดูแผนที่สำนักงาน</a></div>
    </div><div className="footer-bottom">© 2026 DAY NERAMIT · เรียกงาน 10:00–02:00 น. · นัดหมาย 24 ชั่วโมง · การรับงานและนัดหมายต้องได้รับการยืนยัน</div></footer>}
  </body></html>;
}
