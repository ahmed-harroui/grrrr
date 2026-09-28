import { supabase } from "@/lib/supabase";
import { pick } from "@/i18n/useTranslation";
import type { Language } from "@/i18n/translations";

// Health score from GRRRR Care. This is a port of Care's own computeHealthScore
// (care.greatrascals.com) so both apps show the same number: rules live in
// health_profiles, data in vaccinations / vet_visits / medications / pet_documents / pets.

export const CARE_URL = "https://care.greatrascals.com/";
export const careUrlForPet = (petId?: string) => (petId ? `${CARE_URL}pet/${petId}` : CARE_URL);

type Localized = { en: string; fr: string };
type HealthRule = {
  id: string;
  type: "recent" | "exists" | "not_overdue" | "pet_field" | "review_when_active";
  source?: SourceKey;
  review_source?: SourceKey;
  match?: string;
  field?: string;
  weight?: number;
  optional?: boolean;
  grace_days?: number;
  within_days?: number;
  advice: Localized;
};
type HealthCategory = { key: string; weight: number; rules: HealthRule[] };
type HealthProfile = { id: string; species: string; age_group: string; min_age_months: number; max_age_months: number | null; min_coverage?: number; categories: HealthCategory[] };
type SourceKey = "vaccinations" | "vet_visits" | "medications" | "documents";
type Item = { date: string | null; due: string | null; label: string };
type CareData = Record<SourceKey, Record<string, any>[]>;

export type CareLevel = "good" | "attention" | "action";
export type CareStatus = {
  /** "no_data": nothing recorded in Care yet; "insufficient_data": not enough to score */
  status: "ok" | "no_data" | "insufficient_data" | "no_profile";
  score: number | null;
  level: CareLevel | null;
  /** Most useful next step, in both languages */
  advice: Localized | null;
};

const DAY = 864e5;

export function healthLabel(status: CareStatus, language: Language) {
  if (status.status !== "ok") return pick(language, "À compléter", "Incomplete");
  if (status.level === "good") return pick(language, "Bonne santé", "Good health");
  if (status.level === "attention") return pick(language, "À surveiller", "Needs attention");
  return pick(language, "À agir", "Action needed");
}

function ageInMonths(pet: Record<string, any>, now: Date) {
  if (pet.birthday) {
    const birth = new Date(pet.birthday);
    if (!Number.isNaN(birth.getTime())) {
      return Math.max(0, 12 * (now.getFullYear() - birth.getFullYear()) + now.getMonth() - birth.getMonth() - (now.getDate() < birth.getDate() ? 1 : 0));
    }
  }
  return typeof pet.age === "number" && pet.age >= 0 ? 12 * pet.age + 6 : null;
}

function selectProfile(pet: Record<string, any>, profiles: HealthProfile[], now: Date) {
  const species = String(pet.species ?? "").trim().toLowerCase();
  const matching = profiles.filter((p) => p.species.toLowerCase() === species).sort((a, b) => a.min_age_months - b.min_age_months);
  if (!matching.length) return null;
  const months = ageInMonths(pet, now);
  if (months === null) return matching.find((p) => p.age_group === "adult") ?? matching[0];
  return matching.find((p) => months >= p.min_age_months && (p.max_age_months == null || months < p.max_age_months)) ?? matching[matching.length - 1];
}

function items(data: CareData, source: SourceKey): Item[] {
  switch (source) {
    case "vaccinations":
      return data.vaccinations.map((r) => ({ date: r.date ?? null, due: r.next_due ?? null, label: r.vaccine ?? "" }));
    case "vet_visits":
      return data.vet_visits.map((r) => ({ date: r.date ?? null, due: null, label: [r.reason, r.diagnosis].filter(Boolean).join(" ") }));
    case "medications":
      return data.medications.map((r) => ({ date: r.start_date ?? null, due: r.end_date ?? null, label: r.name ?? "" }));
    case "documents":
      return data.documents.map((r) => ({ date: r.issued_on ?? null, due: r.expires_on ?? null, label: [r.doc_type, r.title].filter(Boolean).join(" ") }));
  }
}

const time = (value: string | null) => (value ? new Date(value).getTime() : NaN);

function matchingItems(data: CareData, source: SourceKey, match?: string) {
  const all = items(data, source);
  if (!match) return all;
  try {
    const pattern = new RegExp(match, "i");
    return all.filter((item) => pattern.test(item.label));
  } catch {
    return [];
  }
}

// 1 when on time, then fades to 0 over the grace period.
const decay = (lateDays: number, graceDays = 0) => (lateDays <= 0 ? 1 : graceDays > 0 ? Math.max(0, 1 - lateDays / graceDays) : 0);

function evaluateRule(rule: HealthRule, pet: Record<string, any>, data: CareData, now: number): number | null {
  const missing = rule.optional ? null : 0;
  switch (rule.type) {
    case "recent": {
      const dates = matchingItems(data, rule.source!, rule.match).map((i) => time(i.date)).filter((t) => !Number.isNaN(t));
      if (!dates.length) return missing;
      return decay((now - Math.max(...dates)) / DAY - (rule.within_days ?? 0), rule.grace_days);
    }
    case "exists":
      return matchingItems(data, rule.source!, rule.match).length > 0 ? 1 : missing;
    case "not_overdue": {
      const latest = new Map<string, Item>();
      for (const item of matchingItems(data, rule.source!, rule.match)) {
        const key = item.label.trim().toLowerCase();
        const current = latest.get(key);
        if (!current || time(item.date) > time(current.date)) latest.set(key, item);
      }
      const dues = [...latest.values()].map((i) => time(i.due)).filter((t) => !Number.isNaN(t));
      if (!dues.length) return missing;
      const scores = dues.map((due) => decay((now - due) / DAY, rule.grace_days));
      return scores.reduce((sum, s) => sum + s, 0) / scores.length;
    }
    case "pet_field": {
      const value = pet[rule.field ?? ""];
      return value != null && value !== "" ? 1 : missing;
    }
    case "review_when_active": {
      const active = matchingItems(data, rule.source!, rule.match).filter((i) => {
        const due = time(i.due);
        return Number.isNaN(due) || due >= now;
      });
      if (!active.length) return null;
      const reviews = items(data, rule.review_source!).map((i) => time(i.date)).filter((t) => !Number.isNaN(t));
      if (!reviews.length) return 0;
      return decay((now - Math.max(...reviews)) / DAY - (rule.within_days ?? 0), (rule.within_days ?? 0) / 2);
    }
  }
}

function computeHealthScore(pet: Record<string, any>, data: CareData, profiles: HealthProfile[], date = new Date()): CareStatus {
  const now = date.getTime();
  const profile = selectProfile(pet, profiles, date);
  if (!profile) return { status: "no_profile", score: null, level: null, advice: null };
  const hasData = data.vaccinations.length + data.vet_visits.length + data.medications.length + data.documents.length > 0;
  if (!hasData) return { status: "no_data", score: null, level: null, advice: null };

  const categories = profile.categories.map((category) => {
    const rules = category.rules.map((rule) => ({ rule, score: evaluateRule(rule, pet, data, now) }));
    const scored = rules.filter((r) => r.score != null);
    const weight = scored.reduce((sum, r) => sum + (r.rule.weight ?? 1), 0);
    return { category, rules, score: weight > 0 ? scored.reduce((sum, r) => sum + r.score! * (r.rule.weight ?? 1), 0) / weight : null };
  });
  const totalWeight = profile.categories.reduce((sum, c) => sum + c.weight, 0);
  const scoredCategories = categories.filter((c) => c.score != null);
  const scoredWeight = scoredCategories.reduce((sum, c) => sum + c.category.weight, 0);
  const coverage = totalWeight > 0 ? scoredWeight / totalWeight : 0;
  if (scoredWeight === 0 || coverage < (profile.min_coverage ?? 0.5)) return { status: "insufficient_data", score: null, level: null, advice: null };

  const score = Math.round((100 * scoredCategories.reduce((sum, c) => sum + c.score! * c.category.weight, 0)) / scoredWeight);
  const nextSteps = scoredCategories
    .flatMap((c) => {
      const ruleWeight = c.rules.filter((r) => r.score != null).reduce((sum, r) => sum + (r.rule.weight ?? 1), 0);
      return c.rules
        .filter((r) => r.score != null && r.score < 1)
        .map((r) => ({ advice: r.rule.advice, gain: Math.round(((1 - r.score!) * (r.rule.weight ?? 1)) / ruleWeight * (c.category.weight / scoredWeight) * 100) }));
    })
    .filter((step) => step.gain > 0)
    .sort((a, b) => b.gain - a.gain);
  return { status: "ok", score, level: score >= 80 ? "good" : score >= 50 ? "attention" : "action", advice: nextSteps[0]?.advice ?? null };
}

export async function getCareStatus(petId: string): Promise<CareStatus | null> {
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(petId)) return null;
  const [pet, vaccinations, vetVisits, medications, documents, profiles] = await Promise.all([
    supabase.from("pets").select("*").eq("id", petId).maybeSingle(),
    supabase.from("vaccinations").select("*").eq("pet_id", petId),
    supabase.from("vet_visits").select("*").eq("pet_id", petId),
    supabase.from("medications").select("*").eq("pet_id", petId),
    supabase.from("pet_documents").select("*").eq("pet_id", petId),
    supabase.from("health_profiles").select("*"),
  ]);
  if (!pet.data) return null;
  const data: CareData = {
    vaccinations: vaccinations.data ?? [],
    vet_visits: vetVisits.data ?? [],
    medications: medications.data ?? [],
    documents: documents.data ?? [],
  };
  return computeHealthScore(pet.data, data, (profiles.data ?? []) as HealthProfile[]);
}
