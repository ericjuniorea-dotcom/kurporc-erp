import { z } from "zod";

export const farrowingEventSchema = z.object({
  sowId:               z.string().min(1, "Seleccioná una cerda"),
  serviceEventId:      z.string().optional(),
  farrowingType:       z.enum(["NORMAL", "ASSISTED", "CESAREAN", "DYSTOCIA"]).default("NORMAL"),
  startDatetime:       z.string().min(1, "Fecha y hora de inicio obligatorias"),
  endDatetime:         z.string().optional(),
  bornAlive:           z.coerce.number().min(0, "Requerido"),
  bornDead:            z.coerce.number().min(0).default(0),
  mummified:           z.coerce.number().min(0).default(0),
  femalesBornAlive:    z.coerce.number().min(0).optional(),
  malesBornAlive:      z.coerce.number().min(0).optional(),
  lowViabilityCount:   z.coerce.number().min(0).default(0),
  totalLitterWeightKg: z.coerce.number().min(0, "Peso total requerido"),
  penId:               z.string().optional(),
  sowWeightKg:         z.coerce.number().positive().optional(),
  notes:               z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.femalesBornAlive != null && data.malesBornAlive != null) {
    if (data.femalesBornAlive + data.malesBornAlive !== data.bornAlive) {
      ctx.addIssue({
        code: "custom",
        path: ["femalesBornAlive"],
        message: `Hembras + machos (${data.femalesBornAlive + data.malesBornAlive}) debe igual nacidos vivos (${data.bornAlive})`,
      });
    }
  }
});

export const pigletDeathSchema = z.object({
  farrowingId:  z.string().min(1),
  pigletId:     z.string().optional(),
  deathDatetime: z.string().min(1, "Fecha y hora requeridas"),
  quantity:     z.coerce.number().min(1),
  cause:        z.enum(["WEAKNESS","CRUSHING","DIARRHEA","DEFICIENT","DISEASE","SHELTER","HYPOTHERMIA","ACCIDENT","CONGENITAL","ELIMINATED","OTHER"]),
  notes:        z.string().optional(),
  evidenceUrl:  z.string().optional(),
});

export const pigletMovementSchema = z.object({
  originId:     z.string().min(1, "Cerda donadora requerida"),
  destinationId: z.string().min(1, "Cerda receptora requerida"),
  movementDate: z.string().min(1),
  quantity:     z.coerce.number().min(1),
}).refine((d) => d.originId !== d.destinationId, {
  message: "La cerda donadora y receptora no pueden ser la misma",
  path: ["destinationId"],
});

export const weaningEventSchema = z.object({
  farrowingId:         z.string().min(1),
  weaningDate:         z.string().min(1, "Fecha de destete requerida"),
  lastMinuteDeaths:    z.coerce.number().min(0).default(0),
  lastMinuteReceived:  z.coerce.number().min(0).default(0),
  lastMinuteDonated:   z.coerce.number().min(0).default(0),
  pigletsWeaned:       z.coerce.number().min(1, "Cantidad de destetados requerida"),
  totalLitterWeightKg: z.coerce.number().positive("Peso total requerido"),
  nurseryBatchId:      z.string().optional(),
  sowDestination:      z.enum(["GESTATION","CULL","OTHER"]).default("GESTATION"),
  bodyConditionScore:  z.enum(["SCORE_1","SCORE_2","SCORE_3","SCORE_4","SCORE_5"]).optional(),
  sowWeightKg:         z.coerce.number().positive().optional(),
  notes:               z.string().optional(),
});

export const stockAdjustmentSchema = z.object({
  farrowingId:  z.string().min(1),
  sowId:        z.string().min(1),
  correctStock: z.coerce.number().min(0),
  reason:       z.string().min(1, "Motivo obligatorio"),
  notes:        z.string().optional(),
});

export type FarrowingEventInput  = z.infer<typeof farrowingEventSchema>;
export type PigletDeathInput     = z.infer<typeof pigletDeathSchema>;
export type PigletMovementInput  = z.infer<typeof pigletMovementSchema>;
export type WeaningEventInput    = z.infer<typeof weaningEventSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
