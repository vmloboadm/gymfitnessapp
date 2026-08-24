import { Suspense } from "react";
import { ForgotPasswordForm } from "~/components/auth/ForgotPasswordForm";
import { AuthSkeleton } from "~/components/common/AuthSkeleton";

export const metadata = {
  title: "Recuperar senha",
};

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}