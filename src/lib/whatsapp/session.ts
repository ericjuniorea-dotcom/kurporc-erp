import prisma from "@/lib/db/prisma";

const SESSION_TTL = 30 * 60; // 30 minutos — Regla 6

// Redis opcional — si no hay REDIS_URL, las sesiones WhatsApp se almacenan en memoria
// (el bot WhatsApp funciona pero las sesiones no sobreviven reinicios del servidor)
let _redis: { get(k: string): Promise<string | null>; setex(k: string, ttl: number, v: string): Promise<unknown> } | null = null;

function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (!_redis) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require("ioredis");
    _redis = new Redis(process.env.REDIS_URL);
  }
  return _redis;
}

const memoryStore = new Map<string, { value: string; expiresAt: number }>();

async function cacheGet(k: string): Promise<string | null> {
  const r = getRedis();
  if (r) return r.get(k);
  const entry = memoryStore.get(k);
  if (!entry || entry.expiresAt < Date.now()) { memoryStore.delete(k); return null; }
  return entry.value;
}

async function cacheSet(k: string, ttl: number, v: string): Promise<void> {
  const r = getRedis();
  if (r) { await r.setex(k, ttl, v); return; }
  memoryStore.set(k, { value: v, expiresAt: Date.now() + ttl * 1000 });
}

export type FlowName = "PARTO" | "MUERTE_LECHON" | "PESAJE" | "ALIMENTACION";

export interface SessionContext {
  flow?:    FlowName;
  step?:    string;
  data?:    Record<string, unknown>;
  // Datos listos para guardar, esperando confirmación SI/NO (Regla 6)
  pendingConfirmation?: Record<string, unknown>;
}

export interface WaSession {
  id:          string;
  tenantId:    string;
  userId:      string;
  phoneNumber: string;
  context:     SessionContext;
}

// Clave Redis: wa:session:<phone>
function key(phone: string) { return `wa:session:${phone}`; }

export async function getSession(phone: string): Promise<WaSession | null> {
  const raw = await cacheGet(key(phone));
  if (raw) return JSON.parse(raw) as WaSession;

  // Fallback a la DB
  const dbSession = await prisma.whatsAppSession.findFirst({
    where:   { phoneNumber: phone, status: "ACTIVE" },
    orderBy: { lastActivityAt: "desc" },
  });
  if (!dbSession) return null;

  const session: WaSession = {
    id:          dbSession.id,
    tenantId:    dbSession.tenantId,
    userId:      dbSession.userId,
    phoneNumber: phone,
    context:     (dbSession.context ?? {}) as SessionContext,
  };
  await cacheSet(key(phone), SESSION_TTL, JSON.stringify(session));
  return session;
}

export async function saveSession(session: WaSession): Promise<void> {
  await cacheSet(key(session.phoneNumber), SESSION_TTL, JSON.stringify(session));

  // Sync a DB de forma no bloqueante
  prisma.whatsAppSession.update({
    where: { id: session.id },
    data:  {
      context:        session.context as any,
      currentStep:    session.context.step ?? null,
      lastActivityAt: new Date(),
      expiresAt:      new Date(Date.now() + SESSION_TTL * 1000),
    },
  }).catch(() => {/* best-effort */});
}

export async function clearFlow(session: WaSession): Promise<void> {
  session.context = {};
  await saveSession(session);
}

// Busca o crea sesión a partir del número de teléfono del operario
export async function resolveSession(phone: string): Promise<WaSession | null> {
  const existing = await getSession(phone);
  if (existing) return existing;

  // Buscar usuario por número de teléfono
  const user = await prisma.user.findFirst({
    where: { phone, isActive: true },
    select: { id: true, tenantId: true },
  });
  if (!user) return null;

  // Crear nueva sesión
  const expires = new Date(Date.now() + SESSION_TTL * 1000);
  const dbSession = await prisma.whatsAppSession.create({
    data: {
      tenantId:    user.tenantId,
      userId:      user.id,
      phoneNumber: phone,
      status:      "ACTIVE",
      context:     {},
      expiresAt:   expires,
    },
  });

  const session: WaSession = {
    id:          dbSession.id,
    tenantId:    user.tenantId,
    userId:      user.id,
    phoneNumber: phone,
    context:     {},
  };
  await cacheSet(key(phone), SESSION_TTL, JSON.stringify(session));
  return session;
}

export async function logMessage(
  sessionId: string,
  direction: "IN" | "OUT",
  content:   string,
  waMessageId?: string,
  transcript?:  string
): Promise<void> {
  await prisma.whatsAppMessage.create({
    data: {
      sessionId,
      direction,
      messageType: "text",
      content,
      transcript:  transcript ?? undefined,
      waMessageId: waMessageId ?? undefined,
    },
  }).catch(() => {});
}
