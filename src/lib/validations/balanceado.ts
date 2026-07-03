import { z } from "zod";

export const rawMaterialSchema = z.object({
  name:         z.string().min(1, "Nombre requerido"),
  materialType: z.enum(["PROTEIN","ENERGY","NUCLEUS","ADDITIVE","MINERAL"]),
  supplierId:   z.string().optional(),
  minStockKg:   z.coerce.number().min(0).default(0),
});

export const rawMaterialLotSchema = z.object({
  rawMaterialId:            z.string().min(1),
  lotCode:                  z.string().min(1, "Código de lote requerido"),
  receivedDate:             z.string().min(1),
  quantityKg:               z.coerce.number().positive(),
  pricePerKg:               z.coerce.number().positive(),
  supplierId:               z.string().optional(),
  invoiceNumber:            z.string().optional(),
  expiryDate:               z.string().optional(),
  // Análisis nutricional (opcional, puede venir de IA)
  crudProteinPct:           z.coerce.number().min(0).max(100).optional(),
  metabolizableEnergyKcal:  z.coerce.number().min(0).optional(),
  lysinePct:                z.coerce.number().min(0).optional(),
  methioninePct:            z.coerce.number().min(0).optional(),
  calciumPct:               z.coerce.number().min(0).optional(),
  phosphorusPct:            z.coerce.number().min(0).optional(),
  moisturePct:              z.coerce.number().min(0).max(100).optional(),
  mycotoxinPpb:             z.coerce.number().min(0).optional(),
});

export const formulaVersionSchema = z.object({
  formulaId:    z.string().min(1),
  ingredients:  z.array(z.object({
    rawMaterialId: z.string().min(1),
    inclusionPct:  z.coerce.number().min(0).max(100),
  })).min(1, "La fórmula debe tener al menos 1 ingrediente"),
  aiSuggestionNotes: z.string().optional(),
}).superRefine((data, ctx) => {
  const total = data.ingredients.reduce((s, i) => s + Number(i.inclusionPct), 0);
  const rounded = Math.round(total * 1000) / 1000;
  if (Math.abs(rounded - 100) > 0.001) {
    ctx.addIssue({
      code: "custom",
      path: ["ingredients"],
      message: `La suma de % de ingredientes debe ser exactamente 100%. Suma actual: ${rounded.toFixed(3)}%`,
    });
  }
});

export const approveFormulaSchema = z.object({
  approvalNotes: z.string().optional(),
});

export type RawMaterialInput      = z.infer<typeof rawMaterialSchema>;
export type RawMaterialLotInput   = z.infer<typeof rawMaterialLotSchema>;
export type FormulaVersionInput   = z.infer<typeof formulaVersionSchema>;
export type ApproveFormulaInput   = z.infer<typeof approveFormulaSchema>;
