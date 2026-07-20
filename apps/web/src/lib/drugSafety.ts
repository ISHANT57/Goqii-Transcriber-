/**
 * Lightweight, client-side prescription safety helpers. These are advisory
 * (warn, never block) — the drug universe is far too large for a hardcoded
 * list to be authoritative, and a doctor must always be able to prescribe
 * something not on this list. The goal is catching likely typos (missing
 * unit, garbled frequency) before sign-off, not enforcing a formulary.
 */

/** Common generic drug names in Indian primary-care practice, for autocomplete. */
export const COMMON_DRUGS: readonly string[] = [
  "Paracetamol",
  "Ibuprofen",
  "Aspirin",
  "Diclofenac",
  "Amoxicillin",
  "Amoxicillin-Clavulanate",
  "Azithromycin",
  "Ciprofloxacin",
  "Metronidazole",
  "Cefixime",
  "Cetirizine",
  "Levocetirizine",
  "Chlorpheniramine",
  "Montelukast",
  "Domperidone",
  "Ondansetron",
  "Ranitidine",
  "Pantoprazole",
  "Omeprazole",
  "Rabeprazole",
  "ORS (Oral Rehydration Salts)",
  "Metformin",
  "Glimepiride",
  "Insulin",
  "Amlodipine",
  "Atenolol",
  "Losartan",
  "Telmisartan",
  "Atorvastatin",
  "Rosuvastatin",
  "Salbutamol",
  "Budesonide",
  "Prednisolone",
  "Dexamethasone",
  "Vitamin D3",
  "Vitamin B Complex",
  "Calcium Carbonate",
  "Iron + Folic Acid",
  "Multivitamin",
  "Loperamide",
  "Ondem",
  "Doxycycline",
  "Levofloxacin",
  "Amikacin",
  "Clotrimazole",
  "Fluconazole",
  "Mupirocin",
  "Povidone-Iodine",
  "Diazepam",
  "Alprazolam",
  "Amitriptyline",
  "Cough Syrup (Expectorant)",
];

/**
 * Recognised dose units (mass, volume, count, concentration). "%" is matched
 * as a separate alternative without a trailing `\b` — `%` is a non-word
 * character, so a `\b` immediately after it (e.g. at end-of-string, as in
 * "1%") never matches, which previously flagged valid concentrations like a
 * "1%" cream as missing a unit.
 */
const DOSE_UNIT_RE =
  /\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|drops?|puffs?|tablets?|tabs?|capsules?|caps?|units?|sachets?)\b|\b\d+(\.\d+)?\s*%/i;

/**
 * Sanity-check a dose string. Returns a warning message, or null if it looks
 * fine (or is empty — an empty dose is a separate, non-blocking choice).
 */
export function checkDose(dose: string): string | null {
  const t = dose.trim();
  if (t === "") return null;
  if (!/\d/.test(t)) {
    return "No numeric strength found — did you mean to include a dose (e.g. \"500 mg\")?";
  }
  if (!DOSE_UNIT_RE.test(t)) {
    return "No recognised unit (mg/ml/mcg/g/IU/%/drops/tablets) — double-check this dose.";
  }
  return null;
}

/**
 * Extract the allergy list from the note's "Subjective" text. The server
 * renders this section as label-prefixed lines (see renderSubjective in
 * apps/api/src/lib/processor.ts) — "Allergies: Penicillin, Sulfa drugs" — so we
 * pull the line starting with that label and split it into individual terms.
 */
function extractAllergies(subjectiveText: string): string[] {
  const match = subjectiveText.match(/^Allergies:\s*(.+)$/im);
  if (!match || !match[1]) return [];
  return match[1]
    .split(/[,;]| and /i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^(none|nka|n\/?a|no known)/i.test(s));
}

/**
 * Advisory (never blocking, same philosophy as checkDose/checkFrequency): warn
 * when a prescribed drug name contains — or is contained by — a recorded
 * allergy term. Plain substring matching, not a drug-interaction database —
 * it catches the doctor prescribing the exact allergen by name, not cross-
 * reactive drug classes.
 */
export function checkAllergyConflicts(
  subjectiveText: string,
  prescriptions: { drug_name: string }[],
): string[] {
  const allergies = extractAllergies(subjectiveText ?? "");
  if (allergies.length === 0) return [];

  const warnings: string[] = [];
  for (const rx of prescriptions) {
    const drug = rx.drug_name.trim();
    if (!drug) continue;
    const drugLower = drug.toLowerCase();
    for (const allergy of allergies) {
      const allergyLower = allergy.toLowerCase();
      if (drugLower.includes(allergyLower) || allergyLower.includes(drugLower)) {
        warnings.push(`Patient is allergic to "${allergy}" — prescription includes "${drug}".`);
      }
    }
  }
  return warnings;
}

/** Recognised frequency shorthands and phrasings (English + common Latin abbreviations). */
const FREQUENCY_RE =
  /\b(od|bd|bid|tds|tid|qid|qds|sos|prn|stat|hs|q\d+h|once|twice|thrice|\d+\s*times?)\b|\b(daily|day|night|morning|evening|hourly|weekly)\b/i;

/**
 * Sanity-check a frequency string. Returns a warning message, or null if it
 * looks fine (or is empty).
 */
export function checkFrequency(frequency: string): string | null {
  const t = frequency.trim();
  if (t === "") return null;
  if (!FREQUENCY_RE.test(t)) {
    return "Frequency doesn't match a recognised pattern (e.g. \"twice daily\", \"BD\", \"SOS\") — double-check this.";
  }
  return null;
}
