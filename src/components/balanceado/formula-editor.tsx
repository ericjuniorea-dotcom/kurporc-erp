"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formulaVersionSchema, type FormulaVersionInput } from "@/lib/validations/balanceado";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { NutritionalProfile } from "./nutritional-profile";
import {
  IconAlertTriangle, IconCircleCheck, IconLoader2, IconPlus, IconTrash, IconFlask,
} from "@tabler/icons-react";

interface RawMaterial {
  id:           string;
  name:         string;
  materialType: string;
  lots: Array<{ remainingKg: number; pricePerKg: number }>;
}

interface CalculationResult {
  profile:             import("./nutritional-profile").NutritionalData;
  nutritionalWarnings: string[];
}

interface Props {
  formulaId:   string;
  onSuccess?:  () => void;
  onCancel?:   () => void;
  isVetChief:  boolean;
}

const MATERIAL_TYPE_LABEL: Record<string, string> = {
  PROTEIN:  "Proteínas",
  ENERGY:   "Energéticas",
  NUCLEUS:  "Núcleos",
  ADDITIVE: "Aditivos",
  MINERAL:  "Minerales",
};

export function FormulaEditor({ formulaId, onSuccess, onCancel, isVetChief }: Props) {
  const [materials,   setMaterials]   = useState<RawMaterial[]>([]);
  const [calcResult,  setCalcResult]  = useState<CalculationResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted,   setSubmitted]   = useState(false);

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<FormulaVersionInput>({
      resolver:      zodResolver(formulaVersionSchema),
      defaultValues: { formulaId, ingredients: [] },
    });

  const { fields, append, remove } = useFieldArray({ control, name: "ingredients" });
  const ingredients = watch("ingredients");

  // Suma de porcentajes en tiempo real
  const totalPct = ingredients.reduce((s, i) => s + (Number(i.inclusionPct) || 0), 0);
  const pctOk    = Math.abs(totalPct - 100) < 0.001;

  // Calcular perfil nutricional cuando cambian los ingredientes (debounced)
  useEffect(() => {
    if (ingredients.length === 0 || !pctOk) { setCalcResult(null); return; }
    const t = setTimeout(async () => {
      const res = await fetch("/api/formulas", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ formulaId, ingredients }),
      });
      if (res.ok) {
        const data = await res.json();
        setCalcResult({ profile: data.version, nutritionalWarnings: data.nutritionalWarnings ?? [] });
      }
    }, 600);
    return () => clearTimeout(t);
  }, [JSON.stringify(ingredients), pctOk]);

  // Cargar materias primas
  useEffect(() => {
    fetch("/api/raw-materials").then((r) => r.json()).then(setMaterials);
  }, []);

  async function onSubmit(data: FormulaVersionInput) {
    setServerError(null);
    const res = await fetch("/api/formulas", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      setServerError(
        typeof err.error === "string" ? err.error :
        err.error?.fieldErrors?.ingredients?.[0] ??
        "Error al guardar la versión"
      );
      return;
    }
    setSubmitted(true);
    onSuccess?.();
  }

  const groupedMaterials = Object.entries(MATERIAL_TYPE_LABEL).map(([type, label]) => ({
    type,
    label,
    items: materials.filter((m) => m.materialType === type),
  })).filter((g) => g.items.length > 0);

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <IconCircleCheck className="h-10 w-10 text-green-500" />
        <p className="font-semibold">Versión guardada como INACTIVA</p>
        <p className="text-sm text-muted-foreground">
          {isVetChief
            ? "Podés aprobarla desde el panel de versiones."
            : "El Jefe Veterinario debe aprobarla antes de que entre en vigor (Regla 1)."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <IconAlertTriangle className="h-4 w-4 shrink-0" />{serverError}
        </div>
      )}

      {/* Encabezado de porcentaje */}
      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <span className="text-sm text-muted-foreground">Total ingredientes</span>
        <span className={`text-lg font-bold ${pctOk ? "text-green-600" : totalPct > 100 ? "text-red-600" : "text-amber-600"}`}>
          {totalPct.toFixed(3)}%
          {pctOk && <IconCircleCheck className="inline h-4 w-4 ml-1" />}
          {!pctOk && <span className="text-xs font-normal ml-2">({(100 - totalPct).toFixed(3)}% faltantes)</span>}
        </span>
      </div>

      {/* Lista de ingredientes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <IconFlask className="h-4 w-4" /> Ingredientes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Agregá ingredientes usando el botón de abajo.
            </p>
          )}
          {fields.map((field, idx) => {
            const mat = materials.find((m) => m.id === ingredients[idx]?.rawMaterialId);
            const price = mat?.lots[0]?.pricePerKg;
            return (
              <div key={field.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <Select
                    value={ingredients[idx]?.rawMaterialId ?? ""}
                    onValueChange={(v) => setValue(`ingredients.${idx}.rawMaterialId`, v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Materia prima..." />
                    </SelectTrigger>
                    <SelectContent>
                      {groupedMaterials.map((group) => (
                        <div key={group.type}>
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {group.label}
                          </div>
                          {group.items.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28 shrink-0">
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.001"
                      min={0}
                      max={100}
                      placeholder="0.000"
                      className="h-8 pr-6 text-right font-mono"
                      {...register(`ingredients.${idx}.inclusionPct`)}
                    />
                    <span className="absolute right-2 top-1.5 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                {price != null && (
                  <span className="text-xs text-muted-foreground w-20 text-right shrink-0">
                    ${Number(price).toFixed(0)}/kg
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(idx)}
                  className="h-8 w-8 p-0 text-red-400 hover:text-red-600 shrink-0"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
          {errors.ingredients && (
            <p className="text-xs text-red-600">
              {typeof errors.ingredients === "object" && "message" in errors.ingredients
                ? (errors.ingredients as { message?: string }).message
                : "Error en ingredientes"}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ rawMaterialId: "", inclusionPct: 0 })}
            className="w-full"
          >
            <IconPlus className="h-4 w-4 mr-1" /> Agregar ingrediente
          </Button>
        </CardContent>
      </Card>

      {/* Notas (sugerencias IA u observaciones) */}
      <div className="space-y-2">
        <Label>Notas / Sugerencias IA</Label>
        <textarea
          {...register("aiSuggestionNotes")}
          rows={3}
          placeholder="Observaciones sobre esta versión o sugerencias del asistente IA..."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand resize-none"
        />
      </div>

      {/* Perfil nutricional calculado */}
      {calcResult && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Perfil nutricional calculado</CardTitle>
          </CardHeader>
          <CardContent>
            <NutritionalProfile
              profile={calcResult.profile as any}
              warnings={calcResult.nutritionalWarnings}
            />
          </CardContent>
        </Card>
      )}

      {!isVetChief && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-800">
          <IconAlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          La versión se guardará como INACTIVA. El Jefe Veterinario debe aprobarla para que entre en vigor (Regla 1).
        </div>
      )}

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting || !pctOk || fields.length === 0}>
          {isSubmitting
            ? <><IconLoader2 className="h-4 w-4 animate-spin" /> Guardando...</>
            : "Guardar versión"}
        </Button>
      </div>
    </form>
  );
}
