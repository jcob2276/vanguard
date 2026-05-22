/**
 * import_curriculum.ts
 *
 * Reads setter.yaml and upserts it into dojo_curricula table.
 *
 * Usage:
 *   deno run --allow-read --allow-env --allow-net scripts/import_curriculum.ts
 *
 * Requires env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Or run dry mode to print the JSON without inserting:
 *   deno run --allow-read scripts/import_curriculum.ts --dry
 */

import { parse } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const isDry = Deno.args.includes("--dry");

const yamlText = await Deno.readTextFile("./setter.yaml");
const curriculum = parse(yamlText) as {
  system: {
    bot_name: string;
    skill_slug: string;
    daily_target_reps: Record<string, unknown>;
    feedback_format: string;
    filler_rules: Record<string, unknown>;
  };
  days: unknown[];
};

const slug = curriculum.system.skill_slug;
const name = curriculum.system.bot_name;
const days = curriculum.days;
const metadata = {
  daily_target_reps: curriculum.system.daily_target_reps,
  feedback_format: curriculum.system.feedback_format,
  filler_rules: curriculum.system.filler_rules,
};

console.log(`Curriculum: ${name}`);
console.log(`Slug: ${slug}`);
console.log(`Days: ${days.length}`);

if (isDry) {
  console.log("\n--- DRY RUN: JSON preview (first day) ---");
  console.log(JSON.stringify((days as unknown[])[0], null, 2));
  Deno.exit(0);
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from("dojo_curricula")
  .upsert(
    { slug, name, days, metadata },
    { onConflict: "slug" }
  )
  .select("id, slug, updated_at");

if (error) {
  console.error("Import failed:", error.message);
  Deno.exit(1);
}

console.log("Import successful:", data);
