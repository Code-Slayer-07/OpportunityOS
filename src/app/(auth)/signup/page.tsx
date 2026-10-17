import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
