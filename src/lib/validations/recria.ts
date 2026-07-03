import { z } from "zod";

export const weightRecordSchema = z.object({
  batchId:       z.string().min(1),
  batchType:     z.enum(["NURSERY", "GROWING"]),
  recordDate:    z.string().min(1),
  totalWeightKg: z.coerce.number().positive("El peso total debe ser mayor a 0"),
  animalCount:   z.coerce.number().int().positive("La cantidad de animales debe ser mayor a 0"),
});

export const phaseChangeSchema = z.object({
  nurseryBatchId:   z.string().min(1),
  toPhase:          z.enum(["PHASE_1", "PHASE_2"]),
  changeDate:       z.string().min(1),
  reason:           z.enum(["WEIGHT", "SPACE"]),
  triggerWeightKg:  z.coerce.number().positive().optional(),
  notes:            z.string().optional(),
});

export const transferToGrowingSchema = z.object({
  nurseryBatchId: z.string().min(1),
  entryDate:      z.string().min(1),
  entryWeightKg:  z.coerce.number().positive("Peso de entrada requerido"),
  animalCount:    z.coerce.number().int().positive(),
  penId:          z.string().optional(),
  batchCode:      z.string().min(1, "Código de lote requerido"),
});

export type WeightRecordInput       = z.infer<typeof weightRecordSchema>;
export type PhaseChangeInput        = z.infer<typeof phaseChangeSchema>;
export type TransferToGrowingInput  = z.infer<typeof transferToGrowingSchema>;
