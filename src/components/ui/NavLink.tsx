"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 py-1 text-sm transition ${
        active ? "border-brand-600 font-medium text-brand-700" : "border-transparent text-gray-600 hover:text-brand-600"
      }`}
    >
      {children}
    </Link>
  );
}
