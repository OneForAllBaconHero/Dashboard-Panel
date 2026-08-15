export function slugifyMemberKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const COMMAND_NAME_RULES = /^[a-z0-9_]{1,32}$/

export function validateCommandName(name: string): boolean {
  return COMMAND_NAME_RULES.test(name)
}
