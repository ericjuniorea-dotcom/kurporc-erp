import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { cuentasConSaldo } from "@/lib/finanzas/datos";
import { hoyUTC } from "@/lib/finanzas/calculos";
import { descifrar, enmascarar } from "@/lib/seguridad/cifrado";
import { PanelCuentas } from "./panel";

export const metadata = { title: "Caja y bancos · Finanzas · KurPorc" };

export default async function CajaBancosPage() {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session || !permisos) redirect("/login");
  if (!puede(permisos, "finanzas.caja_bancos.ver")) redirect("/finanzas");
  const { cuentas, sinAsignarGs } = await cuentasConSaldo(session.user.tenantId);
  const verNumero = puede(permisos, "finanzas.caja_bancos.ver_numero");
  const numero = (c: string | null) => {
    if (!c) return "";
    try { const n = descifrar(c); return verNumero ? n : (enmascarar(n, 4) ?? ""); } catch { return "••••"; }
  };
  return (
    <PanelCuentas
      hoy={hoyUTC().toISOString().slice(0, 10)}
      sinAsignarGs={sinAsignarGs.toString()}
      puedo={{ editar: puede(permisos, "finanzas.caja_bancos.editar_cuentas"), declarar: puede(permisos, "finanzas.caja_bancos.declarar_saldo") }}
      cuentas={cuentas.map(c => ({
        id: c.id, nombre: c.nombre, tipo: c.tipo, activa: c.activa, numero: numero(c.numeroCifrado),
        saldoGs: c.saldoGs.toString(), montoAsignadoGs: c.montoAsignadoGs?.toString() ?? null,
        saldoInicialGs: c.saldoInicialGs.toString(), fechaSaldoInicial: c.fechaSaldoInicial?.toISOString().slice(0, 10) ?? null,
        declarado: c.declarado ? { fecha: c.declarado.fecha.toISOString().slice(0, 10), saldoGs: c.declarado.saldoGs.toString(), diferenciaGs: c.declarado.diferenciaGs.toString() } : null,
      }))}
    />
  );
}
