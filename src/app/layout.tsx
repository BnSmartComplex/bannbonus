import type { Metadata } from "next";
import Link from "next/link";
import { AuthControls } from "@/components/auth-controls";
import { PwaRegistration } from "@/components/pwa-registration";
import { Phone, ArrowUpRight } from "lucide-react";
import { dayNeramitBusiness } from "@/lib/day-neramit-business";
import "./globals.css";
export const metadata: Metadata = {
 title: { default: "ช่างเดย์เนรมิตร | เรียกช่างบางใหญ่ บางบัวทอง 10:00–02:00 น.", template: "%s | Day Neramit" },
 description: "ช่างเดย์เนรมิตร ซ่อมแซม ติดตั้ง และดูแลบ้านในบางใหญ่ บางบัวทอง เรียกช่างทันทีตามสถานะพร้อมรับงาน 10:00–02:00 น. จองคิวล่วงหน้าได้ 24 ชั่วโมง",
 robots: { index: true, follow: true },
 icons: { icon: "https://d2ol7oe51mr4n9.cloudfront.net/user_3Jbrjw1A1wOVLHTuEgAgHqYVg57/e7bc55fe-d06b-4d14-ae26-d75e6f59753c.jpg", apple: "/icons/apple-touch-icon.png" },
};
export default function RootLayout({children}: Readonly<{children:React.ReactNode}>) {
 return <html lang="th"><body>
 <PwaRegistration/>
 <div className="topbar"><div className="shell"><span><span className="gold-dot"/> เรียกช่าง 10:00–02:00 น. · นัดหมาย ได้ 24 ชั่วโมง</span><span>อำเภอบางใหญ่และอำเภอบางบัวทอง</span></div></div>
 <header className="site-header"><div className="shell"><nav className="site-nav" aria-label="เมนูหลัก">
 <Link className="brand" href="/"><img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3Jbrjw1A1wOVLHTuEgAgHqYVg57/e7bc55fe-d06b-4d14-ae26-d75e6f59753c.jpg" width="47" height="43" alt="" /><span>ช่างเดย์<b>เนรมิตร</b><small>DAY NERAMIT · SMART SERVICE</small></span></Link>
 <div className="nav-links"><Link href="/#services">บริการของเรา</Link><Link href="/booking?mode=IMMEDIATE">เรียกช่าง</Link><Link href="/booking?mode=BOOKING">นัดหมาย</Link><Link href="/my-bookings">รายการนัดหมาย</Link><Link href="/staff">ทีมงาน</Link></div>
 <div className="header-actions"><a className="phone-link" href="tel:0924367468"><Phone size={16}/> 092-436-7468</a><AuthControls/><Link className="btn btn-gold header-cta" href="/booking">เรียกช่าง <ArrowUpRight size={16}/></Link></div>
 </nav></div></header>
 <div className="site-main shell">{children}</div>
 <footer className="site-footer"><div className="shell footer-grid"><div className="footer-brand"><strong>ช่างเดย์<span>เนรมิตร</span></strong><p>SMART REPAIR &amp; RENOVATION</p><small>บริการช่างในอำเภอบางใหญ่และอำเภอบางบัวทอง</small></div><div><strong>บริการ</strong><Link href="/booking">เรียกช่างและนัดหมาย</Link><Link href="/pricing">ค่าบริการ</Link><Link href="/my-bookings">ติดตามสถานะ นัดหมาย</Link></div><div><strong>ติดต่อ</strong><a href="tel:0924367468">092-436-7468</a><a href="https://line.me/R/ti/p/@0924367468" target="_blank" rel="noopener noreferrer">LINE @0924367468</a><p>บางใหญ่ · บางบัวทอง · นนทบุรี</p><p>สำนักงาน: {dayNeramitBusiness.officeAddress}</p><a href={dayNeramitBusiness.officeMapUrl} target="_blank" rel="noopener noreferrer">ดูแผนที่สำนักงาน</a></div></div><div className="footer-bottom">© 2026 DAY NERAMIT · เรียกงาน 10:00–02:00 น. · นัดหมาย 24 ชั่วโมง · การรับงานและนัดหมายต้องได้รับการยืนยัน</div></footer>
 </body></html>;
}
