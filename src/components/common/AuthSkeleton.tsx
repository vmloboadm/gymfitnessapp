export function AuthSkeleton() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 flex justify-center">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-white/10" />
        </div>
        <div className="space-y-4">
          <div className="skeleton-line h-10" />
          <div className="skeleton-line h-10" />
          <div className="skeleton-line h-12" />
        </div>
      </div>
    </div>
  );
}