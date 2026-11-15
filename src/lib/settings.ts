import { db } from "./db";
import { DEFAULT_RULES, rulesSchema, type Rules } from "./rules-config";

let cache: { value: Rules; at: number } | null = null;
const TTL = 10_000;

export async function getRules(): Promise<Rules> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  const row = await db.setting.findUnique({ where: { key: "rules" } });
  let value = DEFAULT_RULES;
  if (row) {
    try {
      const parsed = rulesSchema.partial().safeParse(JSON.parse(row.value));
      if (parsed.success) value = { ...DEFAULT_RULES, ...parsed.data };
    } catch {
      /* standart dəyərlər */
    }
  }
  cache = { value, at: Date.now() };
  return value;
}

export async function saveRules(rules: Rules, userId: string) {
  const value = JSON.stringify(rulesSchema.parse(rules));
  await db.setting.upsert({
    where: { key: "rules" },
    create: { key: "rules", value, updatedById: userId },
    update: { value, updatedById: userId },
  });
  cache = null;
}
