// Shared cell-formatting helpers for the §6.11 Excel exports (src/exports/registry.ts).
// Collections are queried at depth: 1, so relationship fields arrive as
// either a populated object or an unpopulated id/null — these normalize
// both cases into something readable in a spreadsheet cell.

export function displayName(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'object') return String(value)
  const obj = value as Record<string, unknown>
  return String(obj.name || obj.email || obj.filename || obj.id || '')
}

export function joinDisplayNames(values: unknown): string {
  if (!Array.isArray(values)) return ''
  return values.map(displayName).filter(Boolean).join('; ')
}

export function joinValues(values: unknown): string {
  if (!Array.isArray(values)) return ''
  return values.filter((v) => v !== null && v !== undefined).join('; ')
}

export function formatDate(value: unknown): string {
  if (!value) return ''
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export function formatBoolean(value: unknown): string {
  return value ? 'Yes' : 'No'
}
