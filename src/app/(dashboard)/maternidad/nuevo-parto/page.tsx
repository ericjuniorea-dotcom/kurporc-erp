import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { FormNuevoParto } from "@/components/maternidad/form-nuevo-parto";

export default async function NuevoPartoPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!puede(await getPermisos(), "maternidad.partos.crear")) redirect("/maternidad");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">Registrar Parto</h1>
        <p className="text-sm text-muted-foreground">
          El sistema calculará las tareas sanitarias y la fecha de destete automáticamente.
        </p>
      </div>
      <div className="max-w-2xl">
        <FormNuevoParto />
      </div>
    </div>
  );
}
