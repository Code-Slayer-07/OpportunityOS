import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const STEPS = [
  { n: "1", title: "Find", text: "Tell us about yourself once. We search live internships, jobs, hackathons and scholarships across the web." },
  { n: "2", title: "Prove", text: "Every match shows why you qualify, with the exact sentence from the listing, a source link and the date we read it." },
  { n: "3", title: "Act", text: "Save what you like. Your action plan ranks it by fit and urgency so you never miss a deadline." },
];

function CtaButtons() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link href="/signup" className="inline-flex justify-center rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
        Get started free
      </Link>
      <Link href="/login" className="inline-flex justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-100">
        Log in
      </Link>
    </div>
  );
}

// Static mockup of a real match card (illustrative data, not fetched).
function SampleMatchCard() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-lg" aria-label="Sample match card">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">Sample match</p>
      <div className="flex gap-4">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full bg-green-100 text-green-800 ring-2 ring-green-300">
          <span className="text-lg font-bold leading-none">92</span>
          <span className="text-[10px] uppercase tracking-wide">match</span>
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900">Software Development Intern</h3>
          <p className="text-sm text-gray-600">Example Labs · Remote · ₹30,000/month</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">internship</span>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">2 days left</span>
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-800">
        You are a 3rd-year CSE student graduating in 2027 with the React and Node.js skills this role asks for.
      </p>
      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="text-sm font-medium text-gray-900">
          Graduation year <span className="font-normal text-gray-500">· matches your</span>{" "}
          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">gradYear</span>
        </p>
        <blockquote className="mt-2 border-l-4 border-brand-300 bg-brand-50/50 py-1 pl-3 text-sm italic text-gray-800">
          “…students graduating in 2026 or 2027.”
        </blockquote>
        <p className="mt-2 text-xs text-gray-500">Source: example.com · fetched 17 Oct 2026</p>
      </div>
      <p className="mt-3 text-sm text-gray-600">
        <span className="font-medium text-gray-900">Gap:</span> No Docker experience listed.
      </p>
    </div>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/profile");

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <span className="text-lg font-semibold text-brand-600">OpportunityOS</span>
        <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-brand-600">
          Log in
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-10 md:grid-cols-2 md:py-16">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Find what matters. <span className="text-brand-600">Prove it&apos;s real.</span> Never miss a deadline.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-gray-600">
              Internships, jobs, hackathons and scholarships, matched to your profile. Each recommendation comes with a source, a quote and a reason, so you can trust it.
            </p>
            <div className="mt-8">
              <CtaButtons />
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <SampleMatchCard />
          </div>
        </section>

        <section className="border-y border-gray-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-12">
            <h2 className="text-center text-2xl font-semibold">How it works</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{s.n}</span>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-gray-600">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14 text-center">
          <h2 className="text-2xl font-semibold">Stop opening twelve tabs.</h2>
          <p className="mx-auto mt-2 max-w-xl text-gray-600">Build your profile in under three minutes and see ranked, evidence-backed matches.</p>
          <div className="mt-6 flex justify-center">
            <CtaButtons />
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-500">OpportunityOS · Find what matters. Prove it&apos;s real. Never miss a deadline.</footer>
    </div>
  );
}
