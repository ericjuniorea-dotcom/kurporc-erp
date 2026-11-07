"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconAlertTriangle, IconLoader2, IconEye, IconEyeOff } from "@tabler/icons-react";
import { KurPorcLogo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const loginSchema = z.object({
  email:    z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router  = useRouter();
  const [error,    setError]    = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginForm) {
    setError(null);
    const result = await signIn("credentials", {
      email:    data.email.toLowerCase(),
      password: data.password,
      redirect: false,
    });
    if (result?.error === "BLOQUEADO") {
      setError("Demasiados intentos fallidos. Esperá unos minutos y volvé a probar.");
      return;
    }
    if (result?.error) { setError("Email o contraseña incorrectos."); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-base)",
        padding: 24,
      }}
    >
      {/* Theme toggle arriba a la derecha */}
      <div style={{ position: "fixed", top: 16, right: 16 }}>
        <ThemeToggle />
      </div>

      <div style={{ width: "100%", maxWidth: 360 }}>
        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 32 }}>
          <KurPorcLogo size="lg" showTagline />
        </div>

        {/* Card */}
        <div style={{
          background: "var(--bg-surface)",
          border: "0.5px solid var(--border-default)",
          borderRadius: "var(--radius-xl)",
          padding: "24px",
        }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
              Iniciar sesión
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Ingresá tus credenciales para continuar
            </div>
          </div>

          {error && (
            <div className="kp-alert kp-alert-danger" style={{ marginBottom: 16 }}>
              <IconAlertTriangle size={13} aria-hidden />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Email */}
            <div>
              <label className="kp-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@migranja.com"
                className="kp-input"
                {...register("email")}
              />
              {errors.email && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{errors.email.message}</div>}
            </div>

            {/* Password */}
            <div>
              <label className="kp-label" htmlFor="password">Contraseña</label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="kp-input"
                  style={{ paddingRight: 36 }}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    padding: 0,
                  }}
                >
                  {showPass ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                </button>
              </div>
              {errors.password && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{errors.password.message}</div>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{ width: "100%", height: 36, justifyContent: "center", marginTop: 4 }}
            >
              {isSubmitting
                ? <><IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} aria-hidden /> Iniciando sesión...</>
                : "Iniciar sesión"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "var(--text-muted)" }}>
          KurPorc ERP v2.0 · 2026
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
