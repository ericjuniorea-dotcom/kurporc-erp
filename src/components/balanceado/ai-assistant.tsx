"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconLoader2, IconUpload, IconFileText, IconCircleCheck, IconAlertTriangle, IconSparkles } from "@tabler/icons-react";

interface ExtractionResult {
  materialName?:          string;
  lotCode?:               string;
  supplier?:              string;
  crudProteinPct?:        number | null;
  metabolizableEnergyKcal?: number | null;
  lysinePct?:             number | null;
  methioninePct?:         number | null;
  calciumPct?:            number | null;
  phosphorusPct?:         number | null;
  moisturePct?:           number | null;
  mycotoxinPpb?:          number | null;
  notes?:                 string;
  confidence?:            "HIGH" | "MEDIUM" | "LOW";
  error?:                 string;
}

interface Props {
  onApply?: (data: ExtractionResult) => void;
}

const CONFIDENCE_COLORS = {
  HIGH:   "bg-green-100 text-green-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW:    "bg-red-100 text-red-800",
};

export function AiAssistant({ onApply }: Props) {
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<ExtractionResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setFileName(file.name);
    setLoading(true);
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/ai/analyze-pdf", { method: "POST", body: fd });
    const data: ExtractionResult = await res.json();
    setResult(data);
    setLoading(false);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type === "application/pdf") handleFile(file);
  }

  const fields = result && !result.error ? [
    { label: "Proteína cruda",   value: result.crudProteinPct,          unit: "%" },
    { label: "Energía metabol.", value: result.metabolizableEnergyKcal, unit: "kcal/kg" },
    { label: "Lisina",           value: result.lysinePct,               unit: "%" },
    { label: "Metionina",        value: result.methioninePct,           unit: "%" },
    { label: "Calcio",           value: result.calciumPct,              unit: "%" },
    { label: "Fósforo",          value: result.phosphorusPct,           unit: "%" },
    { label: "Humedad",          value: result.moisturePct,             unit: "%" },
    { label: "Micotoxinas",      value: result.mycotoxinPpb,            unit: "ppb" },
  ] : [];

  return (
    <Card className="border-brand/20 bg-gradient-to-br from-white to-brand/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <IconSparkles className="h-4 w-4 text-brand" />
          Asistente IA — Análisis nutricional
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Subí el certificado de análisis del proveedor (PDF) y la IA extrae los valores automáticamente.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-lg border-2 border-dashed border-brand/30 hover:border-brand/60 hover:bg-brand/5 transition-colors p-8 text-center"
        >
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={onInputChange} />
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-brand">
              <IconLoader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm font-medium">Analizando con Claude AI...</p>
            </div>
          ) : fileName ? (
            <div className="flex flex-col items-center gap-2">
              <IconFileText className="h-8 w-8 text-brand" />
              <p className="text-sm font-medium text-gray-700">{fileName}</p>
              <p className="text-xs text-muted-foreground">Clic para subir otro PDF</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <IconUpload className="h-8 w-8" />
              <p className="text-sm">Arrastrá el PDF o hacé clic para seleccionar</p>
              <p className="text-xs">Certificados de análisis, informes de laboratorio</p>
            </div>
          )}
        </div>

        {/* Resultado de la extracción */}
        {result?.error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-red-800 text-sm">
            <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{result.error}</span>
          </div>
        )}

        {result && !result.error && (
          <div className="space-y-3">
            {/* Header del resultado */}
            <div className="flex items-center justify-between">
              <div>
                {result.materialName && (
                  <p className="font-semibold text-sm">{result.materialName}</p>
                )}
                {result.supplier && (
                  <p className="text-xs text-muted-foreground">{result.supplier}</p>
                )}
                {result.lotCode && (
                  <p className="text-xs text-muted-foreground">Lote: {result.lotCode}</p>
                )}
              </div>
              {result.confidence && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${CONFIDENCE_COLORS[result.confidence]}`}>
                  Confianza {result.confidence === "HIGH" ? "alta" : result.confidence === "MEDIUM" ? "media" : "baja"}
                </span>
              )}
            </div>

            {/* Tabla de valores */}
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {fields.map(({ label, value, unit }) => (
                    <tr key={label} className="bg-white">
                      <td className="px-3 py-2 text-gray-600">{label}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {value != null ? (
                          <span className="font-medium">{value} {unit}</span>
                        ) : (
                          <span className="text-gray-400 text-xs">No encontrado</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result.notes && (
              <p className="text-xs text-muted-foreground bg-gray-50 rounded p-2">
                {result.notes}
              </p>
            )}

            {onApply && (
              <Button
                onClick={() => onApply(result)}
                className="w-full"
                size="sm"
              >
                <IconCircleCheck className="h-4 w-4 mr-2" />
                Usar estos valores para el lote
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
