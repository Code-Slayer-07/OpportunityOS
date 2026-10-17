// Shared Zod schemas (auth, profile). Owner: Dev A.
import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const opportunityType = z.enum(["internship", "job", "hackathon", "scholarship"]);
const text = z.string().trim().min(1);
const optionalUrl = z.union([z.string().trim().url(), z.literal("")]).optional();

// Every field optional so the profile form can be saved partially;
// `profile_complete` is computed server-side from REQUIRED_PROFILE_FIELDS.
export const profileSchema = z.object({
  name: z.string().trim().optional(),
  degree: text.optional(),
  branch: text.optional(),
  gradYear: z.number().int().min(2000).max(2100).optional(),
  currentStatus: text.optional(),
  cgpa: z.number().min(0).max(10).optional(),
  skills: z.array(text).optional(),
  preferredRoles: z.array(text).optional(),
  experienceLevel: text.optional(),
  types: z.array(opportunityType).optional(),
  locations: z.array(text).optional(),
  openToRemote: z.boolean().optional(),
  availabilityDate: z.string().date().optional(),
  githubUrl: optionalUrl,
  linkedinUrl: optionalUrl,
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const REQUIRED_PROFILE_FIELDS = [
  "degree",
  "branch",
  "gradYear",
  "currentStatus",
  "skills",
  "preferredRoles",
  "experienceLevel",
  "types",
  "locations",
] as const satisfies readonly (keyof ProfileInput)[];

// Stricter schema for the profile form: required fields must be filled.
// The API keeps the lenient `profileSchema` so partial saves stay possible.
export const profileFormSchema = profileSchema.extend({
  name: z.string().trim().min(1, "Name is required"),
  degree: z.string().trim().min(1, "Select your degree"),
  branch: z.string().trim().min(1, "Branch is required"),
  gradYear: z
    .number({ error: "Enter your graduation year" })
    .int("Enter a valid year")
    .min(2000, "Enter a valid year")
    .max(2100, "Enter a valid year"),
  currentStatus: z.string().trim().min(1, "Select your current status"),
  skills: z.array(text).min(1, "Add at least one skill"),
  preferredRoles: z.array(text).min(1, "Add at least one preferred role"),
  experienceLevel: z.string().trim().min(1, "Select your experience level"),
  types: z.array(opportunityType).min(1, "Select at least one opportunity type"),
  locations: z.array(text).min(1, "Add at least one location"),
  cgpa: z
    .number({ error: "Enter a number" })
    .min(0, "CGPA must be between 0 and 10")
    .max(10, "CGPA must be between 0 and 10")
    .optional(),
  githubUrl: z.union([z.string().trim().url("Enter a valid URL"), z.literal("")]).optional(),
  linkedinUrl: z.union([z.string().trim().url("Enter a valid URL"), z.literal("")]).optional(),
});
