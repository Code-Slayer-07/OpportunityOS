import Link from "next/link";
import { Providers } from "@/components/Providers";
import { LogoutButton } from "@/components/auth/LogoutButton";

const links = [
  { href: "/profile", label: "Profile" },
  { href: "/matches", label: "Matches" },
  { href: "/action-plan", label: "Action Plan" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4 sm:gap-6">
            <span className="font-semibold text-indigo-600">OpportunityOS</span>
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-gray-700 hover:text-indigo-600">
                {l.label}
              </Link>
            ))}
          </div>
          <LogoutButton />
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Providers>{children}</Providers>
      </main>
    </div>
  );
}
