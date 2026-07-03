"use client";

import { IconCircleCheck, IconAlertTriangle, IconCircleX } from "@tabler/icons-react";

export interface NutritionalData {
  totalProteinPct:    number;
  totalEnergyKcal:    number;
  totalLysinePct:     number;
  totalMethioninePct: number;
  totalCalciumPct:    number;
  totalPhosphorusPct: number;
  totalMoisturePct:   number;
  totalMycotoxinPpb:  number;
}

interface TargetRange {
  label:   string;
  value:   number;
  unit:    string;
  min?:    number;
  max?:    number;
  warn?:   boolean; // si está fuera de rango
}

interface Props {
  profile:  NutritionalData;
  warnings: string[];
}

export function NutritionalProfile({ profile, warnings }: Props) {
  const rows: TargetRange[] = [
    { label: "Proteína cruda",     value: profile.totalProteinPct,    unit: "%" },
    { label: "Energía metabol.",   value: profile.totalEnergyKcal,    unit: "kcal/kg" },
    { label: "Lisina",             value: profile.totalLysinePct,     unit: "%" },
    { label: "Metionina",          value: profile.totalMethioninePct, unit: "%" },
    { label: "Calcio",             value: profile.totalCalciumPct,    unit: "%" },
    { label: "Fósforo",            value: profile.totalPhosphorusPct, unit: "%" },
    { label: "Humedad",            value: profile.totalMoisturePct,   unit: "%" },
    { label: "Micotoxinas",        value: profile.totalMycotoxinPpb,  unit: "ppb" },
  ];

  const hasWarning = (label: string) =>
    warnings.some((w) => w.toLowerCase().includes(label.split(" ")[0].toLowerCase()));

  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1">
          <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            <IconAlertTriangle className="h-4 w-4" /> Alertas nutricionales
          </p>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-800">{w}</p>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">Nutriente</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-600">Valor calculado</th>
              <th className="px-4 py-2.5 text-center font-medium text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => {
              const isBad = hasWarning(row.label);
              return (
                <tr key={row.label} className={isBad ? "bg-red-50" : "bg-white"}>
                  <td className="px-4 py-2.5 text-gray-700">{row.label}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium">
                    {row.value.toLocaleString("es-PY", { maximumFractionDigits: 3 })} {row.unit}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {isBad ? (
                      <IconCircleX className="h-4 w-4 text-red-500 inline" />
                    ) : (
                      <IconCircleCheck className="h-4 w-4 text-green-500 inline" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
