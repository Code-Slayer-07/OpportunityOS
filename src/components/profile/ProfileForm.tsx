"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TagInput } from "@/components/ui/TagInput";
import { useProfile, useSaveProfile, type ProfileResponse } from "@/hooks/useProfile";
import { profileFormSchema } from "@/lib/validation/schemas";

const toOptions = (values: string[]) => values.map((v) => ({ value: v, label: v }));
const DEGREES = toOptions(["B.Tech", "BCA", "B.Sc", "M.Tech", "MBA", "Other"]);
const STATUSES = toOptions(["1st year", "2nd year", "3rd year", "4th year", "Graduated", "Fresher"]);
const EXPERIENCE = [
  { value: "none", label: "None" },
  { value: "projects", label: "Projects" },
  { value: "internship_done", label: "Internship done" },
];
const TYPES = ["internship", "job", "hackathon", "scholarship"] as const;

interface FormState {
  name: string;
  degree: string;
  branch: string;
  gradYear: string;
  currentStatus: string;
  cgpa: string;
  skills: string[];
  preferredRoles: string[];
  experienceLevel: string;
  types: string[];
  locations: string[];
  openToRemote: boolean;
  availabilityDate: string;
  githubUrl: string;
  linkedinUrl: string;
}

const fromProfile = (p: ProfileResponse): FormState => ({
  name: p.name ?? "",
  degree: p.degree ?? "",
  branch: p.branch ?? "",
  gradYear: p.gradYear != null ? String(p.gradYear) : "",
  currentStatus: p.currentStatus ?? "",
  cgpa: p.cgpa != null ? String(p.cgpa) : "",
  skills: p.skills ?? [],
  preferredRoles: p.preferredRoles ?? [],
  experienceLevel: p.experienceLevel ?? "",
  types: p.types ?? [],
  locations: p.locations ?? [],
  openToRemote: p.openToRemote ?? false,
  availabilityDate: p.availabilityDate ?? "",
  githubUrl: p.githubUrl ?? "",
  linkedinUrl: p.linkedinUrl ?? "",
});

const DEMO_PROFILE: Partial<FormState> = {
  degree: "B.Tech",
  branch: "CSE",
  gradYear: "2027",
  currentStatus: "3rd year",
  cgpa: "8.2",
  skills: ["React", "Python", "Node.js", "ML"],
  preferredRoles: ["SDE intern"],
  experienceLevel: "projects",
  types: ["internship", "hackathon"],
  locations: ["Delhi", "Bangalore"],
  openToRemote: true,
};

// Form state -> API payload. Empty optional fields are omitted (URLs send "" so they can be cleared).
function toPayload(f: FormState) {
  return {
    name: f.name,
    degree: f.degree,
    branch: f.branch,
    gradYear: f.gradYear.trim() === "" ? undefined : Number(f.gradYear),
    currentStatus: f.currentStatus,
    cgpa: f.cgpa.trim() === "" ? undefined : Number(f.cgpa),
    skills: f.skills,
    preferredRoles: f.preferredRoles,
    experienceLevel: f.experienceLevel,
    types: f.types,
    locations: f.locations,
    openToRemote: f.openToRemote,
    availabilityDate: f.availabilityDate || undefined,
    githubUrl: f.githubUrl.trim(),
    linkedinUrl: f.linkedinUrl.trim(),
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function Form({ profile }: { profile: ProfileResponse }) {
  const [form, setForm] = useState<FormState>(() => fromProfile(profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const save = useSaveProfile();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };
  const text = (key: "name" | "branch" | "gradYear" | "cgpa" | "availabilityDate" | "githubUrl" | "linkedinUrl") => ({
    name: key,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value),
    error: errors[key],
  });

  function toggleType(type: string) {
    set("types", form.types.includes(type) ? form.types.filter((t) => t !== type) : [...form.types, type]);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const parsed = profileFormSchema.safeParse(toPayload(form));
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    save.mutate(parsed.data, { onSuccess: () => setSaved(true) });
  }

  const complete = profile.profileComplete;

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Your profile</h1>
          <p className="mt-1 text-sm text-gray-600">Tell us about you once. We use it to find and prove your matches.</p>
        </div>
        {process.env.NODE_ENV !== "production" && (
          <button
            type="button"
            onClick={() => {
              setForm((f) => ({ ...f, ...DEMO_PROFILE, name: f.name || "Aarav S" }));
              setErrors({});
              setSaved(false);
            }}
            className="rounded-lg border border-dashed border-gray-400 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            Fill demo profile
          </button>
        )}
      </div>

      <Section title="Education">
        <Input label="Name" autoComplete="name" {...text("name")} />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
          <input
            value={profile.email ?? ""}
            readOnly
            disabled
            className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-500"
          />
        </div>
        <Select label="Degree" name="degree" options={DEGREES} value={form.degree} onChange={(e) => set("degree", e.target.value)} error={errors.degree} />
        <Input label="Branch" placeholder="e.g. CSE" {...text("branch")} />
        <Input label="Graduation year" type="number" inputMode="numeric" placeholder="2027" {...text("gradYear")} />
        <Select label="Current status" name="currentStatus" options={STATUSES} value={form.currentStatus} onChange={(e) => set("currentStatus", e.target.value)} error={errors.currentStatus} />
        <Input label="CGPA (optional)" type="number" step="0.01" min={0} max={10} {...text("cgpa")} />
      </Section>

      <Section title="Skills & Roles">
        <div className="sm:col-span-2">
          <TagInput label="Skills" value={form.skills} onChange={(v) => set("skills", v)} placeholder="Type a skill, press Enter" error={errors.skills} />
        </div>
        <div className="sm:col-span-2">
          <TagInput label="Preferred roles" value={form.preferredRoles} onChange={(v) => set("preferredRoles", v)} placeholder="e.g. SDE intern" error={errors.preferredRoles} />
        </div>
        <Select label="Experience level" name="experienceLevel" options={EXPERIENCE} value={form.experienceLevel} onChange={(e) => set("experienceLevel", e.target.value)} error={errors.experienceLevel} />
      </Section>

      <Section title="Preferences">
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-sm font-medium text-gray-700">Opportunity types</legend>
          <div className="flex flex-wrap gap-3">
            {TYPES.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm capitalize">
                <input type="checkbox" checked={form.types.includes(t)} onChange={() => toggleType(t)} className="h-4 w-4 accent-brand-600" />
                {t}
              </label>
            ))}
          </div>
          {errors.types && <p className="mt-1 text-sm text-red-600">{errors.types}</p>}
        </fieldset>
        <div className="sm:col-span-2">
          <TagInput label="Locations" value={form.locations} onChange={(v) => set("locations", v)} placeholder="e.g. Delhi" error={errors.locations} />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={form.openToRemote}
            aria-label="Open to remote"
            onClick={() => set("openToRemote", !form.openToRemote)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${form.openToRemote ? "bg-brand-600" : "bg-gray-300"}`}
          >
            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${form.openToRemote ? "translate-x-5" : ""}`} />
          </button>
          <span className="text-sm text-gray-700">Open to remote</span>
        </div>
        <Input label="Available from (optional)" type="date" {...text("availabilityDate")} />
      </Section>

      <Section title="Links">
        <Input label="GitHub URL (optional)" type="url" placeholder="https://github.com/you" {...text("githubUrl")} />
        <Input label="LinkedIn URL (optional)" type="url" placeholder="https://linkedin.com/in/you" {...text("linkedinUrl")} />
      </Section>

      {save.isError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {save.error.message}
        </p>
      )}
      {saved && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Profile saved.</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save profile"}
        </Button>
        {complete && (
          <Link href="/matches" className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700">
            Find opportunities →
          </Link>
        )}
      </div>
    </form>
  );
}

export function ProfileForm() {
  const { data, isLoading, error, refetch } = useProfile();

  if (isLoading) return <p className="text-gray-600">Loading profile…</p>;
  if (error || !data) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-red-700">{error?.message ?? "Could not load profile."}</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }
  return <Form profile={data} />;
}
