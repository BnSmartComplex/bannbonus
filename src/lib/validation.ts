import { z } from "zod";

export const booking = z
  .object({
    category: z.string().trim().min(1).max(100),
    fault_description: z.string().trim().min(20).max(4000),
    brand: z.string().trim().max(120),
    model_number: z.string().trim().max(120),
    area: z.enum(["BANGKOK", "NONTHABURI"]),
    contact_name: z.string().trim().min(2).max(120),
    contact_phone: z.string().regex(/^0[0-9]{8,9}$/),
    photo_paths: z.array(z.string()).max(4),
    consent: z.literal(true),
  })
  .superRefine((value, context) => {
    if (!(value.brand && value.model_number) && value.photo_paths.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["photo_paths"],
        message: "ต้องระบุยี่ห้อและรุ่น หรือแนบภาพอุปกรณ์อย่างน้อย 1 รูป",
      });
    }
  });
