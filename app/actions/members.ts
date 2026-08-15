"use server"

import { db } from "@/lib/db"
import { members } from "@/lib/db/schema"
import { slugifyMemberKey } from "@/lib/slug"
import { eq } from "drizzle-orm"

export type SyncMemberInput = {
  name: string
  data: object
  backgroundImageUrl?: string | null
  accentColor?: string | null
}

// Espelha os membros da aba Pré-Imagem para o banco, para que o servidor
// (bot do Discord) sempre gere a imagem com os dados mais recentes.
export async function syncMembers(list: SyncMemberInput[]) {
  for (const item of list) {
    const memberKey = slugifyMemberKey(item.name)
    if (!memberKey) continue

    await db
      .insert(members)
      .values({
        memberKey,
        displayName: item.name,
        statsJson: JSON.stringify(item.data ?? {}),
        backgroundImageUrl: item.backgroundImageUrl || null,
        accentColor: item.accentColor || null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: members.memberKey,
        set: {
          displayName: item.name,
          statsJson: JSON.stringify(item.data ?? {}),
          backgroundImageUrl: item.backgroundImageUrl || null,
          accentColor: item.accentColor || null,
          updatedAt: new Date(),
        },
      })
  }

  return { ok: true }
}

export async function listMembers() {
  return db.select().from(members).orderBy(members.displayName)
}

export async function getMember(memberKey: string) {
  const rows = await db.select().from(members).where(eq(members.memberKey, memberKey)).limit(1)
  return rows[0] ?? null
}
