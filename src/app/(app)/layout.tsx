import Link from "next/link";
import { ActionPlanNavLink } from "@/components/action-plan/ActionPlanNavLink";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Providers } from "@/components/Providers";
import { NavLink } from "@/components/ui/NavLink";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
          <nav aria-label="Main" className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-3 sm:gap-6">
              <Link href="/" className="shrink-0 font-semibold text-brand-600" aria-label="OpportunityOS home">
                <span className="sm:hidden">OS</span>
                <span className="hidden sm:inline">OpportunityOS</span>
              </Link>
              <NavLink href="/profile">Profile</NavLink>
              <NavLink href="/matches">Matches</NavLink>
              <ActionPlanNavLink />
            </div>
            <LogoutButton />
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
      </div>
    </Providers>
  );
}
