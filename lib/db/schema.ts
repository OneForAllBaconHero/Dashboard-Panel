import { boolean, integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core"

// Espelha os dados da aba "Pré-Imagem" para que o servidor (bot do Discord)
// consiga gerar a imagem sem depender do navegador/localStorage.
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  memberKey: text("member_key").notNull().unique(),
  displayName: text("display_name").notNull(),
  statsJson: text("stats_json").notNull().default("{}"),
  backgroundImageUrl: text("background_image_url"),
  accentColor: text("accent_color"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const commands = pgTable("commands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  memberKey: text("member_key").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  registered: boolean("registered").notNull().default(false),
  discordCommandId: text("discord_command_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const commandBlocks = pgTable(
  "command_blocks",
  {
    id: serial("id").primaryKey(),
    commandId: integer("command_id").notNull(),
    discordUserId: text("discord_user_id").notNull(),
    discordUsername: text("discord_username"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    commandUser: unique().on(table.commandId, table.discordUserId),
  }),
)
