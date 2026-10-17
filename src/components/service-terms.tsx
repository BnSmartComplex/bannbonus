import { SERVICE_POLICY as policy } from "@/modules/booking/service-policy";

export function ServiceTerms() {
  return (
    <section className="card" aria-labelledby="service-terms-title">
      <h2 id="service-terms-title">เวลารับงานและค่าออกตรวจ</h2>
      <p>ประสานงานช่างรับเหมาอิสระ · รับงานเรียกช่างใหม่ทุกวัน {policy.dispatchHours} น. ของวันถัดไป (เวลาไทย)</p>
      <p><strong>ส่งคำขอ Booking ล่วงหน้าฟรี</strong> ต้องรอเจ้าหน้าที่อนุมัติก่อนยืนยันนัด ไม่รับประกันว่ามีช่างพร้อมทันที</p>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt>{policy.ordinaryHours} น.</dt><dd className="text-2xl font-bold">{policy.ordinaryFeeBaht} บาท</dd></div>
        <div><dt>{policy.nightHours} น.</dt><dd className="text-2xl font-bold">เริ่มต้น {policy.nightFeeBaht} บาท</dd></div>
      </dl>
      <p>ค่าเดินทางและออกตรวจภายใน {policy.includedRoadMeters / 1000} กม. ตามเส้นทางถนนจากฐานของช่างที่ได้รับมอบหมาย คิดตามเวลาที่ลูกค้ายืนยันการออกเดินทาง และแจ้งค่าใช้จ่ายให้ยอมรับก่อนช่างออกเดินทาง</p>
      <p>เกิน 5 กม. ต้องตรวจสอบและตกลงราคาก่อน ยังไม่คิดส่วนเพิ่มอัตโนมัติ</p>
      <p>หลัง 02:00 น. ปิดรับงานเรียกช่างใหม่ งานที่รับแล้วดำเนินต่อได้ และยังส่งคำขอ Booking ล่วงหน้าได้</p>
      <p>ช่างประเมินค่าแรงและวัสดุหน้างาน ลูกค้าต้องอนุมัติใบเสนอราคาก่อนเริ่มซ่อม เมื่ออนุมัติซ่อมและงานเสร็จ ลดค่าแรง {policy.completedRepairLaborDiscountBaht} บาท ไม่เกินค่าแรงจริง ไม่ใช่คืนค่าเดินทางเต็มจำนวน</p>
      <p>ลูกค้าปฏิเสธการซ่อมได้ โดยชำระเฉพาะค่าออกตรวจที่ตกลงไว้ ไม่มีช่างออกให้บริการ ไม่มีค่าออกตรวจ</p>
    </section>
  );
}
