import { z } from "zod";

export const serviceEventSchema = z.object({
  sowId:          z.string().min(1, "Seleccioná una cerda"),
  serviceDate:    z.string().min(1, "Fecha obligatoria"),
  serviceType:    z.enum(["AI", "NATURAL_MOUNT"]),
  boarCode:       z.string().optional(),
  doseCode:       z.string().optional(),
  elaborationDate: z.string().optional(),
  expiryDate:     z.string().optional(),
  durationMinutes: z.coerce.number().min(0).optional(),
  notes:          z.string().optional(),
  currentWeightKg: z.coerce.number().positive("Ingresá el peso actual de la cerda"),
}).superRefine((data, ctx) => {
  if (data.serviceType === "AI") {
    if (!data.doseCode) {
      ctx.addIssue({ code: "custom", path: ["doseCode"], message: "Código de dosis requerido para IA" });
    }
    if (!data.elaborationDate) {
      ctx.addIssue({ code: "custom", path: ["elaborationDate"], message: "Fecha de elaboración requerida" });
    }
    if (!data.expiryDate) {
      ctx.addIssue({ code: "custom", path: ["expiryDate"], message: "Fecha de caducidad requerida" });
    }
  }
  if (data.serviceType === "NATURAL_MOUNT" && !data.boarCode) {
    ctx.addIssue({ code: "custom", path: ["boarCode"], message: "Código del reproductor requerido" });
  }
});

export const pregnancyCheckSchema = z.object({
  sowId:           z.string().min(1),
  serviceEventId:  z.string().min(1, "Seleccioná el servicio"),
  checkDate:       z.string().min(1),
  method:          z.enum(["ULTRASOUND", "BLOOD_TEST", "VISUAL"]),
  result:          z.enum(["PREGNANT", "NOT_PREGNANT", "RECHECK"]),
  notes:           z.string().optional(),
});

export type ServiceEventInput   = z.infer<typeof serviceEventSchema>;
export type PregnancyCheckInput = z.infer<typeof pregnancyCheckSchema>;
