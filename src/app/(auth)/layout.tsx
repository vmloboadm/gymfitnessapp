export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <main className="w-full max-w-md">{children}</main>
      </div>
    </div>
  );
}