// Catálogo estático local de marcas/productos porcinos comunes, para el
// autocompletado del modal "Agregar vacuna". Sin llamadas de red ni IA —
// es un array fijo curado a mano, filtrado en el cliente.

export interface MarcaCatalogo {
  laboratorio: string;
  marcaComercial: string;
  principioActivo: string;
}

export const LABORATORIOS = [
  "Hipra", "Boehringer Ingelheim", "Zoetis", "MSD", "Ceva", "Elanco", "Varios",
] as const;

export const CATALOGO_MARCAS: MarcaCatalogo[] = [
  { laboratorio: "Hipra", marcaComercial: "Suiseng", principioActivo: "Parvovirus porcino + Erysipelothrix rhusiopathiae + Leptospira spp." },
  { laboratorio: "Hipra", marcaComercial: "Rhinisheng", principioActivo: "Bordetella bronchiseptica + Pasteurella multocida toxigénica" },
  { laboratorio: "Hipra", marcaComercial: "Eryseng", principioActivo: "Erysipelothrix rhusiopathiae serotipo 1 + 2 inactivado" },
  { laboratorio: "Hipra", marcaComercial: "Eryseng Parvo", principioActivo: "Parvovirus porcino + Erysipelothrix rhusiopathiae" },
  { laboratorio: "Hipra", marcaComercial: "Unistrain PRRS", principioActivo: "PRRS virus vivo modificado" },
  { laboratorio: "Boehringer Ingelheim", marcaComercial: "Ingelvac CircoFLEX", principioActivo: "Circovirus porcino tipo 2 (subunit.)" },
  { laboratorio: "Boehringer Ingelheim", marcaComercial: "Ingelvac PRRS MLV", principioActivo: "PRRS virus vivo modificado" },
  { laboratorio: "Boehringer Ingelheim", marcaComercial: "Ingelvac MycoFLEX", principioActivo: "Mycoplasma hyopneumoniae inactivada" },
  { laboratorio: "Zoetis", marcaComercial: "Farrowsure Gold B", principioActivo: "Parvovirus porcino + Leptospira spp." },
  { laboratorio: "Zoetis", marcaComercial: "FluSure XP", principioActivo: "Influenza porcina H1N1 + H3N2 inactivada" },
  { laboratorio: "Zoetis", marcaComercial: "Fostera PCV", principioActivo: "Circovirus porcino tipo 2 (subunit.)" },
  { laboratorio: "MSD", marcaComercial: "Porcilis Glässer", principioActivo: "Haemophilus parasuis (Glässer)" },
  { laboratorio: "MSD", marcaComercial: "Porcilis APP", principioActivo: "A. pleuropneumoniae serotipo 1, 2, 5, 6 inactivado" },
  { laboratorio: "MSD", marcaComercial: "Porcilis PCV M Hyo", principioActivo: "Circovirus porcino tipo 2 + Mycoplasma hyopneumoniae" },
  { laboratorio: "MSD", marcaComercial: "Clostrishield 4", principioActivo: "E.coli K88/K99 + Clostridium perfringens A/C" },
  { laboratorio: "Ceva", marcaComercial: "Circovac", principioActivo: "Circovirus porcino tipo 2 (inactivado)" },
  { laboratorio: "Ceva", marcaComercial: "Neumovac", principioActivo: "Mycoplasma hyopneumoniae inactivada" },
  { laboratorio: "Elanco", marcaComercial: "M+PAC", principioActivo: "Mycoplasma hyopneumoniae inactivada" },
  { laboratorio: "Varios", marcaComercial: "Gleptosil", principioActivo: "Fe-dextrano 200 mg/ml" },
];

export function buscarMarcas(query: string, laboratorio?: string): MarcaCatalogo[] {
  const q = query.trim().toLowerCase();
  return CATALOGO_MARCAS.filter(m => {
    if (laboratorio && m.laboratorio !== laboratorio) return false;
    if (!q) return true;
    return m.marcaComercial.toLowerCase().includes(q) || m.principioActivo.toLowerCase().includes(q);
  });
}
