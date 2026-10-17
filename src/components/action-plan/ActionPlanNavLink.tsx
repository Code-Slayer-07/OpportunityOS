"use client";

import { NavLink } from "@/components/ui/NavLink";
import { isOpen, useApplications } from "@/hooks";

// Navbar link with a badge counting open items due in under 3 days.
export function ActionPlanNavLink() {
  const { data } = useApplications();
  const urgent = (data ?? []).filter((a) => isOpen(a) && a.urgency === "red").length;

  return (
    <NavLink href="/action-plan">
      Action Plan
      {urgent > 0 && (
        <span aria-label={`${urgent} urgent`} className="rounded-full bg-red-600 px-1.5 text-xs font-semibold leading-5 text-white">
          {urgent}
        </span>
      )}
    </NavLink>
  );
}
