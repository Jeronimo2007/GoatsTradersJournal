"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            display_name: displayName.trim() || undefined,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // If email confirmation is disabled, session is returned immediately.
      if (data.session) {
        router.replace("/");
        router.refresh();
        return;
      }

      setInfo(
        "Cuenta creada. Revisa tu correo para confirmar, luego inicia sesión."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registro fallido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-xl font-semibold">Crear cuenta</h1>
      <p className="mt-1 text-sm text-muted">
        Regístrate para empezar a registrar tus operaciones.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="field-label" htmlFor="displayName">
            Nombre de usuario
          </label>
          <input
            id="displayName"
            type="text"
            autoComplete="name"
            className="field-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Opcional"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="field-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="confirm">
            Confirmar contraseña
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="field-input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-sm text-loss" role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className="text-sm text-profit" role="status">
            {info}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary w-full justify-center"
          disabled={loading}
        >
          {loading ? "Creando…" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tienes una cuenta?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
