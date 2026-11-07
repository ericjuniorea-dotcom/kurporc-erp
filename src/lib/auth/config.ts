import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db/prisma";

// Los 14 roles del sistema (IDs 1-14)
export const ROLES = {
  SUPER_ADMIN:        1,
  FARM_ADMIN:         2,
  GENERAL_MANAGER:    3,
  VET_CHIEF:          4,  // ÚNICO que aprueba cambios de fórmula (Regla 1)
  PRODUCTION_CHIEF:   5,
  BAL_MANAGER:        6,
  LOGISTICS_MANAGER:  7,
  HR_CHIEF:           8,
  ACCOUNTANT:         9,
  MATERNITY_MANAGER:  10,
  GESTATION_MANAGER:  11,
  NURSERY_MANAGER:    12,
  FIELD_OPERATOR:     13,
  EMPLOYEE_PORTAL:    14,
} as const;

export type RoleId = (typeof ROLES)[keyof typeof ROLES];

export const authOptions: NextAuthOptions = {
  // Nota: PrismaAdapter maneja Account/Session/VerificationToken.
  // Para Credentials (email/password) usamos JWT session en lugar de DB sessions.
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas
  },
  pages: {
    signIn: "/login",
    error:  "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email:    { label: "Email",      type: "email"    },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: {
            userRoles: { select: { roleId: true } },
            tenant:    { select: { id: true, slug: true, farmName: true, plan: true, isActive: true } },
          },
        });

        if (!user || !user.isActive) return null;
        if (!user.tenant.isActive)   return null;

        const passwordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!passwordValid) return null;

        return {
          id:        user.id,
          email:     user.email,
          name:      user.name,
          tenantId:  user.tenantId,
          tenantSlug: user.tenant.slug,
          farmName:  user.tenant.farmName,
          plan:      user.tenant.plan,
          roles:     user.userRoles.map((ur) => ur.roleId),
          language:  user.language,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Primera vez — datos del authorize()
        token.id         = user.id;
        token.tenantId   = (user as any).tenantId;
        token.tenantSlug = (user as any).tenantSlug;
        token.farmName   = (user as any).farmName;
        token.plan       = (user as any).plan;
        token.roles      = (user as any).roles;
        token.language   = (user as any).language;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id         = token.id as string;
        session.user.tenantId   = token.tenantId as string;
        session.user.tenantSlug = token.tenantSlug as string;
        session.user.farmName   = token.farmName as string;
        session.user.plan       = token.plan as string;
        session.user.roles      = token.roles as number[];
        session.user.language   = token.language as string;
      }
      return session;
    },
  },
};

// Helper para Server Components y API Routes
export const getSession = () => getServerSession(authOptions);

// Helpers de verificación de roles — los roles son acumulables (Regla crítica)
export function hasRole(roles: number[], roleId: RoleId): boolean {
  return roles.includes(roleId);
}

export function hasAnyRole(roles: number[], ...roleIds: RoleId[]): boolean {
  return roleIds.some((id) => roles.includes(id));
}

export function canApproveStockAdjustments(roles: number[]): boolean {
  // REGLA 2: Solo el Jefe de producción aprueba ajustes de stock
  return roles.includes(ROLES.PRODUCTION_CHIEF) ||
         roles.includes(ROLES.FARM_ADMIN) ||
         roles.includes(ROLES.SUPER_ADMIN);
}

export function canAccessFinancials(roles: number[]): boolean {
  return roles.includes(ROLES.FARM_ADMIN) ||
         roles.includes(ROLES.ACCOUNTANT) ||
         roles.includes(ROLES.SUPER_ADMIN);
}
