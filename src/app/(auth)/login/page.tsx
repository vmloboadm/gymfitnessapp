import { Suspense } from "react";
import { LoginForm } from "~/components/auth/LoginForm";
import { DevDemoAccess } from "~/components/auth/DevDemoAccess";
import { AuthSkeleton } from "~/components/common/AuthSkeleton";

export const metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <LoginForm />
      <DevDemoAccess />
    </Suspense>
  );
}