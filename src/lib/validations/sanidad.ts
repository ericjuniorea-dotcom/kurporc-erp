import { z } from "zod";

export const completeHealthTaskSchema = z.object({
  healthTaskId:        z.string().min(1),
  applicationDate:     z.string().min(1),
  quantityApplied:     z.coerce.number().int().positive(),
  ageAtApplicationDays: z.coerce.number().int().min(0).optional(),
  productLot:          z.string().optional(),
  productExpiry:       z.string().optional(),
  medicineStockId:     z.string().optional(),
  notes:               z.string().optional(),
});

export const curativeTreatmentSchema = z.object({
  farrowingId:      z.string().optional(),
  pigletId:         z.string().optional(),
  diagnosisType:    z.enum(["DIARRHEA", "ARTHRITIS", "PNEUMONIA", "OTHER"]),
  diagnosisNotes:   z.string().optional(),
  medicineId:       z.string().min(1, "Seleccioná un medicamento"),
  doseMl:           z.coerce.number().positive("Dosis requerida"),
  animalsAffected:  z.coerce.number().int().positive("Al menos 1 animal afectado"),
  treatmentDays:    z.coerce.number().int().positive().default(1),
  startDate:        z.string().min(1),
  endDate:          z.string().optional(),
  withdrawalDays:   z.coerce.number().int().min(0).default(0),
}).refine(
  (d) => d.farrowingId || d.pigletId,
  { message: "Debe especificarse un parto o lechón" }
);

export type CompleteHealthTaskInput  = z.infer<typeof completeHealthTaskSchema>;
export type CurativeTreatmentInput   = z.infer<typeof curativeTreatmentSchema>;
