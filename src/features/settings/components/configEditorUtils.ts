import { useTranslation } from 'react-i18next'
import type { Config } from '../../../types/api/config'
import type { JsonRecord, Lang } from './configEditorTypes'

export function tx(en: string, zh: string, lang: Lang): string {
  return lang.startsWith('zh') ? zh : en
}

export function useLang(): Lang {
  const { i18n } = useTranslation('settings')
  return i18n.language
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? {})) as T
}

export function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

export function getObject(source: unknown, key: string): JsonRecord {
  const value = isRecord(source) ? source[key] : undefined
  return isRecord(value) ? value : {}
}

export function hasRoot(config: Config, key: string) {
  return key in (config as JsonRecord)
}

export function hasNested(config: Config, path: string[]) {
  let current: unknown = config
  for (const key of path) {
    if (!isRecord(current) || !(key in current)) return false
    current = current[key]
  }
  return true
}

export function setRoot(config: Config, key: string, value: unknown): Config {
  return { ...(config as JsonRecord), [key]: value } as Config
}

export function setNested(config: Config, path: string[], value: unknown): Config {
  const next = clone(config) as JsonRecord
  let current = next
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]
    if (!isRecord(current[key])) current[key] = {}
    current = current[key] as JsonRecord
  }
  current[path[path.length - 1]] = value
  return next as Config
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => String(item)) : []
}

export function previewValue(value: unknown, lang: Lang): string {
  if (value === undefined || value === null) return tx('not set', '未设置', lang)
  if (typeof value === 'string') return value || tx('(empty)', '（空）', lang)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return tx(`${value.length} item(s)`, `${value.length} 项`, lang)
  if (isRecord(value)) {
    const n = Object.keys(value).length
    return tx(`${n} field(s)`, `${n} 个字段`, lang)
  }
  return String(value)
}

export function suggestCopyId(id: string, existing: JsonRecord) {
  const base = `${id}-copy`
  if (!(base in existing)) return base
  for (let i = 2; i < 1000; i++) {
    const next = `${base}-${i}`
    if (!(next in existing)) return next
  }
  return `${base}-${Date.now()}`
}
