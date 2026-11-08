// Cliente por organización (Fase 7, parte 2).
// `dbOrg(orgId, actorId)` devuelve un Prisma que:
//   · agrega el filtro de organización a TODA lectura, actualización y borrado (tenantId u organizacionId),
//   · completa la organización en cada alta y rechaza altas para otra organización,
//   · fija app.actor_id en cada escritura para que el historial sepa quién fue (ver conActor).
// Así un olvido de `where: { tenantId }` ya no puede mostrar ni tocar datos de otra organización.
// Uso: `const db = await dbDeSesion(); if (!db) return 401; await db.sow.findMany(...)`.
// Ojo: para varias escrituras atómicas usá `conActor()` + filtros explícitos; las escrituras de dbOrg ya
// abren su propia transacción corta para fijar el actor y no se anidan dentro de un `$transaction` interactivo.
import { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { getSession } from "@/lib/auth/config";

type Campo = "tenantId" | "organizacionId";

/** Modelo → campo de organización. `User` no se filtra: una persona puede estar en varias organizaciones. */
export const CAMPO_ORG: Record<string, Campo> = Object.fromEntries(
  Prisma.dmmf.datamodel.models
    .filter(m => m.name !== "User")
    .flatMap(m => {
      const c = m.fields.find(f => f.name === "tenantId" || f.name === "organizacionId");
      return c ? [[m.name, c.name as Campo]] : [];
    }),
);

const LECTURAS_Y_MASIVAS = new Set(["findMany", "findFirst", "findFirstOrThrow", "count", "aggregate", "groupBy", "updateMany", "deleteMany", "updateManyAndReturn"]);
const UNICAS = new Set(["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"]);
const ESCRITURAS = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "upsert", "delete", "deleteMany"]);

export class ErrorOrganizacion extends Error {}

function conOrg(campo: Campo, org: string, data: unknown) {
  if (!data || typeof data !== "object") return data;
  const d = data as Record<string, unknown>;
  const actual = d[campo];
  if (actual !== undefined && actual !== org) throw new ErrorOrganizacion(`Intento de escribir en otra organización (${campo})`);
  // Si el alta usa la relación (connect) en vez del campo, no se agrega el escalar
  const relacion = campo === "tenantId" ? "tenant" : "organizacion";
  if (relacion in d) return d;
  return { ...d, [campo]: org };
}

export function dbOrg(organizacionId: string, actorId: string | null) {
  return prisma.$extends({
    name: "organizacion",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const campo = CAMPO_ORG[model];
          if (campo) {
            const a = (args ?? {}) as Record<string, unknown>;
            const filtro = { [campo]: organizacionId };
            if (LECTURAS_Y_MASIVAS.has(operation)) {
              a.where = a.where ? { AND: [a.where, filtro] } : filtro;
            } else if (UNICAS.has(operation)) {
              // Prisma 5 acepta filtros extra en un where único
              a.where = { ...(a.where as object), ...filtro };
            }
            if (operation === "create" || operation === "upsert") {
              if (operation === "create") a.data = conOrg(campo, organizacionId, a.data);
              else a.create = conOrg(campo, organizacionId, a.create);
            }
            if (operation === "createMany" || operation === "createManyAndReturn") {
              a.data = Array.isArray(a.data) ? a.data.map(x => conOrg(campo, organizacionId, x)) : conOrg(campo, organizacionId, a.data);
            }
            if ((operation === "update" || operation === "updateMany" || operation === "upsert")) {
              const datos = (operation === "upsert" ? a.update : a.data) as Record<string, unknown> | undefined;
              if (datos && campo in datos && datos[campo] !== organizacionId) throw new ErrorOrganizacion("No se puede mover un registro a otra organización");
            }
            args = a as typeof args;
          }
          if (actorId && ESCRITURAS.has(operation)) {
            const [, resultado] = await prisma.$transaction([
              prisma.$executeRaw`select set_config('app.actor_id', ${actorId}, true)`,
              query(args),
            ]);
            return resultado;
          }
          return query(args);
        },
      },
    },
  });
}

export type DbOrg = ReturnType<typeof dbOrg>;

/** dbOrg de la organización activa de la sesión, o null sin sesión. */
export async function dbDeSesion(): Promise<DbOrg | null> {
  const session = await getSession();
  return session ? dbOrg(session.user.tenantId, session.user.id) : null;
}
