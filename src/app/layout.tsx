import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OpportunityOS: Find what matters. Prove it's real.", template: "%s | OpportunityOS" },
  description: "Live internships, jobs, hackathons and scholarships matched to your profile, with quoted evidence and deadline tracking.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#4f46e5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
