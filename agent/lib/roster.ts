/**
 * The village roster — who lives where and what they do, as the midwife should
 * see it. Pure: combines the registry bundled into the running deployment (what
 * actually routes right now) with the registry on main (which may be ahead by a
 * birth that hasn't redeployed yet). The list_villagers tool adds Slack channel names.
 */

import type { VillagerRecord } from "./villages.ts";

export type RosterStatus = "live" | "deploying";

export type RosterRow = {
  slug: string;
  name: string;
  icon: string;
  dir: string;
  /** One line on what the villager does; "" when the registry entry has none. */
  description: string;
  channelId: string;
  /** live = routes in the current deployment; deploying = on main, not yet deployed. */
  status: RosterStatus;
};

function row(channelId: string, r: VillagerRecord, status: RosterStatus): RosterRow {
  return { slug: r.slug, name: r.name, icon: r.icon, dir: r.dir, description: r.description ?? "", channelId, status };
}

export function rosterFromRegistries(
  deployed: Record<string, VillagerRecord>,
  onMain: Record<string, VillagerRecord> | null,
): RosterRow[] {
  const rows: RosterRow[] = [];
  for (const [channelId, r] of Object.entries(deployed)) rows.push(row(channelId, r, "live"));
  if (onMain) {
    for (const [channelId, r] of Object.entries(onMain)) {
      if (channelId in deployed) continue;
      rows.push(row(channelId, r, "deploying"));
    }
  }
  return rows;
}
