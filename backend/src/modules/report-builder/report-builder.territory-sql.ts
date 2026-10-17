import { Prisma } from "@prisma/client";

/**
 * Agent/workplace territory: «zona / oblast / shahar» (work_slots.territory / users.territory).
 * Client geography bo‘sh bo‘lsa — constructor «Область/Зона/Город» shu manbadan to‘ldiriladi.
 */

/** Primary territory string from active work slot, else agent.user territory. */
export function agentTerritoryRawSql(): Prisma.Sql {
  return Prisma.sql`COALESCE(
    NULLIF(btrim(agent_ws.territory), ''),
    NULLIF(btrim(agent.territory), '')
  )`;
}

/** 1=zona, 2=oblast, 3=shahar — split_part 1-indexed, separator « / ». */
export function agentTerritoryPartSql(part: 1 | 2 | 3): Prisma.Sql {
  return Prisma.sql`NULLIF(
    btrim(
      split_part(
        COALESCE(
          NULLIF(btrim(agent_ws.territory), ''),
          NULLIF(btrim(agent.territory), ''),
          ''
        ),
        ' / ',
        ${Prisma.raw(String(part))}
      )
    ),
    ''
  )`;
}

/** Client value, else agent workplace territory part, else ''. */
export function resolvedClientTerritorySql(
  clientColumn: "zone" | "region" | "city",
  agentPart: 1 | 2 | 3
): Prisma.Sql {
  const clientRef =
    clientColumn === "zone"
      ? Prisma.sql`c.zone`
      : clientColumn === "region"
        ? Prisma.sql`c.region`
        : Prisma.sql`c.city`;
  return Prisma.sql`COALESCE(
    NULLIF(btrim(${clientRef}), ''),
    ${agentTerritoryPartSql(agentPart)},
    ''
  )`;
}

export function resolvedZoneSql(): Prisma.Sql {
  return resolvedClientTerritorySql("zone", 1);
}

export function resolvedRegionSql(): Prisma.Sql {
  return resolvedClientTerritorySql("region", 2);
}

export function resolvedCitySql(): Prisma.Sql {
  return resolvedClientTerritorySql("city", 3);
}
