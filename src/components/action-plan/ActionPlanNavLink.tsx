"use client";

import Link from "next/link";
import { isOpen, useApplications } from "@/hooks";

// Navbar link with a badge counting open items due in under 3 days.
export function ActionPlanNavLink() {
  const { data } = useApplications();
  const urgent = (data ?? []).filter((a) => isOpen(a) && a.urgency === "red").length;

  return (
    <Link href="/action-plan" className="inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-indigo-600">
      Action Plan
      {urgent > 0 && (
        <span aria-label={`${urgent} urgent`} className="rounded-full bg-red-600 px-1.5 text-xs font-semibold leading-5 text-white">
          {urgent}
        </span>
      )}
    </Link>
  );
}
