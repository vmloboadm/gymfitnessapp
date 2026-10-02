"use client";

/** Tela de senha do painel interno (POST nativo p/ /admin/login). */
export function AdminLogin({ erro }: { erro?: boolean }) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <form
        action={`${base}/admin/login`}
        method="post"
        className="w-full max-w-sm rounded-2xl border border-border bg-card/70 p-6 shadow-lg"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-brand">GymFitness</p>
        <h1 className="mt-1 text-xl font-black text-foreground">Painel interno</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Área do dev — acompanhe alunos, scans e uso do app.
        </p>

        <label htmlFor="password" className="mt-5 block text-xs font-semibold text-muted-foreground">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand"
          placeholder="••••••••"
        />
        {erro ? (
          <p className="mt-2 text-xs font-semibold text-danger" role="alert">
            Senha incorreta.
          </p>
        ) : null}

        <button
          type="submit"
          className="mt-4 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-brand-foreground transition-colors hover:bg-brand/90"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
