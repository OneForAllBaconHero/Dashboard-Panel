import nacl from "tweetnacl"

const DISCORD_API = "https://discord.com/api/v10"

export function verifyDiscordRequest(rawBody: string, signature: string | null, timestamp: string | null): boolean {
  const publicKey = process.env.DISCORD_PUBLIC_KEY
  if (!publicKey || !signature || !timestamp) return false

  try {
    return nacl.sign.detached.verify(
      Buffer.from(timestamp + rawBody),
      Buffer.from(signature, "hex"),
      Buffer.from(publicKey, "hex"),
    )
  } catch {
    return false
  }
}

type DiscordCommandInput = { name: string; description: string }
type DiscordCommandResult = { id: string; name: string }

// Bulk overwrite dos slash commands globais do bot (PUT substitui a lista inteira).
export async function registerGlobalCommands(commandsToRegister: DiscordCommandInput[]): Promise<DiscordCommandResult[]> {
  const token = process.env.DISCORD_BOT_TOKEN
  const appId = process.env.DISCORD_APPLICATION_ID

  if (!token || !appId) {
    throw new Error("DISCORD_BOT_TOKEN ou DISCORD_APPLICATION_ID não configurados.")
  }

  const res = await fetch(`${DISCORD_API}/applications/${appId}/commands`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      commandsToRegister.map((c) => ({
        name: c.name,
        description: c.description.slice(0, 100),
        type: 1,
      })),
    ),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Falha ao registrar comandos no Discord (${res.status}): ${text}`)
  }

  const data = (await res.json()) as Array<{ id: string; name: string }>
  return data.map((d) => ({ id: d.id, name: d.name }))
}

export async function getBotStatus(): Promise<{ configured: boolean; username?: string; error?: string }> {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) return { configured: false }

  try {
    const res = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bot ${token}` },
    })
    if (!res.ok) return { configured: false, error: `Token inválido (HTTP ${res.status})` }
    const data = await res.json()
    return { configured: true, username: data.username }
  } catch (err) {
    return { configured: false, error: err instanceof Error ? err.message : "Erro desconhecido" }
  }
}
