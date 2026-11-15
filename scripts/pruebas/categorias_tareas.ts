/**
 * Categorías de las órdenes de trabajo (src/lib/tareas/categorias.ts), con títulos reales.
 *   npm run prueba:categorias-tareas
 */
import { categoriaTarea } from "@/lib/tareas/categorias";

function check(cond: unknown, msg: string) { if (!cond) throw new Error(`FALLA: ${msg}`); console.log(`  ✓ ${msg}`); }
const es = (tipo: string, titulo: string, c: string) => check(categoriaTarea({ tipo, titulo }) === c, `${tipo} · «${titulo}» → ${c} (dio ${categoriaTarea({ tipo, titulo })})`);

es("alimentacion", "Ración de gestación", "ALIMENTACION");
es("vacuna-atrasada", "RHINISENG atrasada · Cerda 51", "VACUNACION");
es("vacuna-lechones", "Circovirus + Micoplasma", "VACUNACION");
es("manejo-sanitario", "Refuerzo / desparasitación · Lechones · lote L-0001", "MEDICACION");
es("hierro-fe", "Hierro + anticoccidial", "MEDICACION");
es("tratamiento-curativo", "Antibiótico cerda 58", "MEDICACION");
es("manejo-sanitario", "Descole, descolmillado, castración · Lechones · lote L-0001", "MANEJO");
es("manejo-sanitario", "Manejo neonatal · Lechones · lote L-0001 (camada 55)", "MANEJO");
es("destete", "Destete camada 13014", "MANEJO");
es("parto-esperado", "Parto esperado cerda 13022", "REPRODUCCION");
es("diagnostico-prenez", "Ecografía día 28", "REPRODUCCION");
es("limpieza-bebederos", "Limpieza de bebederos", "INSTALACIONES");
es("control-temperatura", "Control de temperatura", "INSTALACIONES");
es("revision-datos", "Revisar la camada P-0019", "REVISION");
es("otra-cosa", "Llamar al proveedor", "OTRA");
console.log("Todo bien.");
