# C1 — Technician Availability and Dispatch Eligibility

สถานะ: Draft implementation for human review; ยังไม่ merge และยังไม่ apply ต่อ hosted Supabase

## Contract

`technician_presence` เก็บสถานะที่ช่างกำหนดเอง (`ONLINE` หรือ `OFFLINE`) แยกจากความพร้อมที่ backend คำนวณ `set_technician_presence()` เป็นทางเดียวที่ช่าง authenticated ใช้เปลี่ยน presence และบันทึก `last_seen_at` ใหม่

`technician_capabilities` เก็บคู่พื้นที่/ทักษะที่ tenant อนุญาตให้ช่างรับงาน ค่าเหล่านี้เป็นข้อมูล operational configuration ไม่ใช่การอนุมานจาก UI

`technician_visits` เก็บ check-in/check-out ของ appointment และมี unique partial index ที่อนุญาต active visit ได้ไม่เกินหนึ่งรายการต่อช่าง

`get_technician_dispatch_eligibility()` คำนวณผลจากข้อมูล backend ได้แก่:

- presence ต้องเป็น `ONLINE`
- heartbeat ต้องใหม่ภายใน 5 นาที
- ไม่มี active visit ที่ยังไม่ check-out
- ไม่มี active assignment หรือ booking ที่ช่วงเวลาซ้อนกัน
- skill และ service area ต้อง match

ผลลัพธ์คืนทั้ง boolean flags และ `reasons` ที่ตรวจสอบได้ เช่น `OFFLINE`, `PRESENCE_STALE`, `ACTIVE_VISIT`, `SCHEDULE_CONFLICT`, `SKILL_MISMATCH` และ `AREA_MISMATCH` ไม่เก็บ `AVAILABLE` เป็นค่าที่ client ตั้งเอง

`dispatch_and_assign_technician()` ทำ authorization, booking lock, technician advisory lock, eligibility check, appointment insert, booking confirmation และ audit ใน transaction เดียว โดย exclusion constraint ของ appointment เป็นชั้นป้องกันสุดท้ายต่อ overlap

## Scope boundary

C1 ไม่เปิด payment, LINE, production deploy หรือ hosted migration และยังไม่อ้างว่าเป็นระบบ dispatch ครบทุก capability เพราะ job/route/travel-buffer model ระยะยาวยังต้องพัฒนาต่อ การอนุมัติ advance booking เดิมยังใช้ RPC เดิม; `dispatch_and_assign_technician()` เป็น command แยกสำหรับ immediate dispatch ที่ต้องผ่าน eligibility ปัจจุบัน

การใช้ migration `0004_technician_availability.sql` กับ hosted project ต้องรอ schema drift review, backup และ owner approval ตามแผน C2
