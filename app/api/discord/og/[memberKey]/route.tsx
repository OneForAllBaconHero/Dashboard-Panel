import { ImageResponse } from "@vercel/og"
import { getMember } from "@/app/actions/members"

export const runtime = "nodejs"

function parseStatsLines(statsText: string | undefined): { label: string; value: string }[] {
  if (!statsText) return []
  return statsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("➳"))
    .map((line) => {
      const withoutMarker = line.replace(/^➳\s*/, "")
      const [label, ...rest] = withoutMarker.split("=")
      return { label: (label || "").trim(), value: rest.join("=").trim() }
    })
    .filter((row) => row.label)
    .slice(0, 8)
}

export async function GET(_req: Request, { params }: { params: Promise<{ memberKey: string }> }) {
  const { memberKey } = await params
  const member = await getMember(memberKey)

  if (!member) {
    return new Response("Membro não encontrado", { status: 404 })
  }

  let data: Record<string, any> = {}
  try {
    data = JSON.parse(member.statsJson)
  } catch {
    data = {}
  }

  const badge = data.customBadge || "Membro"
  const stats = parseStatsLines(data.statsText)
  const accent = member.accentColor || "#a855f7"
  const bg = member.backgroundImageUrl || undefined

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0b0b12",
          backgroundImage: bg
            ? `linear-gradient(180deg, rgba(11,11,18,0.55) 0%, rgba(11,11,18,0.92) 100%), url(${bg})`
            : `radial-gradient(circle at 30% 20%, ${accent}33, transparent 60%)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          padding: "48px",
          fontFamily: "sans-serif",
          color: "#f5f5f7",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              padding: "6px 18px",
              borderRadius: 999,
              backgroundColor: accent,
              color: "#0b0b12",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            {badge.toUpperCase()}
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 20, fontSize: 64, fontWeight: 800 }}>{member.displayName}</div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 32,
            gap: 12,
            padding: "28px 32px",
            borderRadius: 20,
            backgroundColor: "rgba(0,0,0,0.45)",
            border: `2px solid ${accent}66`,
          }}
        >
          {stats.length === 0 && (
            <div style={{ display: "flex", fontSize: 24, opacity: 0.7 }}>Sem estatísticas cadastradas.</div>
          )}
          {stats.map((row, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}>
              <div style={{ display: "flex", opacity: 0.75 }}>{row.label}</div>
              <div style={{ display: "flex", fontWeight: 700, color: accent }}>{row.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", marginTop: "auto", fontSize: 18, opacity: 0.5 }}>Painel de Comandos</div>
      </div>
    ),
    { width: 1024, height: 640 },
  )
}
