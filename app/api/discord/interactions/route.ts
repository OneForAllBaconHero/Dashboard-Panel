import { verifyDiscordRequest } from "@/lib/discord"
import { db } from "@/lib/db"
import { commandBlocks, commands } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

export const runtime = "nodejs"

const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
}

const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-signature-ed25519")
  const timestamp = req.headers.get("x-signature-timestamp")

  if (!verifyDiscordRequest(rawBody, signature, timestamp)) {
    return new Response("Assinatura inválida", { status: 401 })
  }

  const interaction = JSON.parse(rawBody)

  if (interaction.type === InteractionType.PING) {
    return Response.json({ type: InteractionResponseType.PONG })
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const commandName = interaction.data?.name as string
    const discordUserId: string | undefined = interaction.member?.user?.id || interaction.user?.id

    const rows = await db.select().from(commands).where(eq(commands.name, commandName)).limit(1)
    const command = rows[0]

    if (!command || !command.enabled) {
      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "Este comando não está disponível.", flags: 64 },
      })
    }

    if (discordUserId) {
      const blockRows = await db
        .select()
        .from(commandBlocks)
        .where(and(eq(commandBlocks.commandId, command.id), eq(commandBlocks.discordUserId, discordUserId)))
        .limit(1)

      if (blockRows.length > 0) {
        return Response.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "Você está bloqueado de usar este comando.", flags: 64 },
        })
      }
    }

    const origin = new URL(req.url).origin
    const imageUrl = `${origin}/api/discord/og/${command.memberKey}?t=${Date.now()}`

    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{ image: { url: imageUrl } }],
      },
    })
  }

  return new Response("Tipo de interação não suportado", { status: 400 })
}
