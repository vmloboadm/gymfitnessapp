export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#050507]">
      {/* Imagem cinematográfica dark — academia/ atleta */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1920&q=80"
          alt=""
          className="h-full w-full object-cover object-center"
        />
        {/* overlay dark cinematográfico já usado no app + vinheta */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050507]/70 via-[#050507]/65 to-[#050507]/90" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_40%_at_50%_20%,rgba(244,113,30,0.18),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E")` }} />
      </div>
      <div className="relative flex flex-1 items-center justify-center px-4 py-10">
        <main className="w-full max-w-md">{children}</main>
      </div>
    </div>
  );
}