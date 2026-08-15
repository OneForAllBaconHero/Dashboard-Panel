"use server"

import { db } from "@/lib/db"
import { commandBlocks, commands } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getBotStatus, registerGlobalCommands } from "@/lib/discord"
import { validateCommandName } from "@/lib/slug"

export async function getDiscordBotStatus() {
  return getBotStatus()
}

export async function listCommands() {
  return db.select().from(commands).orderBy(commands.createdAt)
}

export async function createCommand(input: { name: string; description: string; memberKey: string }) {
  const name = input.name.trim().toLowerCase()
  if (!validateCommandName(name)) {
    throw new Error("Nome de comando inválido. Use apenas letras minúsculas, números e underscore (1-32 caracteres).")
  }
  if (!input.memberKey) {
    throw new Error("Selecione qual membro este comando dispara.")
  }

  await db.insert(commands).values({
    name,
    description: input.description?.trim() || `Mostra as estatísticas de ${input.memberKey}`,
    memberKey: input.memberKey,
  })

  revalidatePath("/")
  return { ok: true }
}

export async function updateCommand(
  id: number,
  input: { name?: string; description?: string; memberKey?: string; enabled?: boolean },
) {
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (input.name !== undefined) {
    const name = input.name.trim().toLowerCase()
    if (!validateCommandName(name)) {
      throw new Error("Nome de comando inválido. Use apenas letras minúsculas, números e underscore (1-32 caracteres).")
    }
    updates.name = name
    updates.registered = false
    updates.discordCommandId = null
  }
  if (input.description !== undefined) updates.description = input.description.trim()
  if (input.memberKey !== undefined) updates.memberKey = input.memberKey
  if (input.enabled !== undefined) updates.enabled = input.enabled

  await db.update(commands).set(updates).where(eq(commands.id, id))
  revalidatePath("/")
  return { ok: true }
}

export async function deleteCommand(id: number) {
  await db.delete(commandBlocks).where(eq(commandBlocks.commandId, id))
  await db.delete(commands).where(eq(commands.id, id))
  revalidatePath("/")
  return { ok: true }
}

export async function listBlocks(commandId: number) {
  return db.select().from(commandBlocks).where(eq(commandBlocks.commandId, commandId))
}

export async function blockUser(commandId: number, discordUserId: string, discordUsername?: string) {
  const id = discordUserId.trim()
  if (!/^\d{5,25}$/.test(id)) {
    throw new Error("ID do Discord inválido. Deve conter apenas números.")
  }

  await db
    .insert(commandBlocks)
    .values({ commandId, discordUserId: id, discordUsername: discordUsername?.trim() || null })
    .onConflictDoNothing()

  revalidatePath("/")
  return { ok: true }
}

export async function unblockUser(blockId: number) {
  await db.delete(commandBlocks).where(eq(commandBlocks.id, blockId))
  revalidatePath("/")
  return { ok: true }
}

export async function isUserBlocked(commandId: number, discordUserId: string) {
  const rows = await db
    .select()
    .from(commandBlocks)
    .where(and(eq(commandBlocks.commandId, commandId), eq(commandBlocks.discordUserId, discordUserId)))
    .limit(1)
  return rows.length > 0
}

// Registra (bulk overwrite) todos os comandos ativos como slash commands globais no Discord.
export async function registerAllCommands() {
  const allCommands = await db.select().from(commands).where(eq(commands.enabled, true))

  const result = await registerGlobalCommands(
    allCommands.map((c) => ({
      name: c.name,
      description: c.description || `Mostra as estatísticas`,
    })),
  )

  for (const registered of result) {
    await db
      .update(commands)
      .set({ registered: true, discordCommandId: registered.id })
      .where(eq(commands.name, registered.name))
  }

  revalidatePath("/")
  return { ok: true, count: result.length }
}
