import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, ChevronDownIcon, PlusIcon, TrashIcon } from '../../../components/Icons'
import { Toggle } from './SettingsUI'
import { JsonDraftErrorContext } from './configEditorJsonDraft'
import type { Choice, JsonRecord } from './configEditorTypes'
import { asStringArray, isRecord, tx, useLang } from './configEditorUtils'

let jsonDraftIDSeed = 0

export const fieldClass =
  'min-w-0 w-full rounded-lg border border-border-200/60 bg-bg-000 px-3 py-2 text-[length:var(--fs-sm)] text-text-100 outline-none transition-colors focus:border-accent-main-100 placeholder:text-text-500'

function enumChoices(values: string[]): Choice[] {
  return values.map(value => ({ value, label: value }))
}

export function TextField({
  value,
  onChange,
  placeholder,
  mono,
}: {
  value: unknown
  onChange: (value: string) => void
  placeholder?: string
  mono?: boolean
}) {
  return (
    <input
      value={value === undefined || value === null ? '' : String(value)}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className={`${fieldClass} ${mono ? 'font-mono' : ''}`}
    />
  )
}

export function TextArea({ value, onChange, placeholder, rows = 4 }: { value: unknown; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value === undefined || value === null ? '' : String(value)}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`${fieldClass} resize-y leading-relaxed`}
    />
  )
}

export function NumberField({
  value,
  onChange,
  placeholder,
}: {
  value: unknown
  onChange: (value: number | undefined) => void
  placeholder?: string
}) {
  const lang = useLang()
  const external = typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
  const [prevExternal, setPrevExternal] = useState(external)
  const [draft, setDraft] = useState(external)
  const [invalid, setInvalid] = useState(false)
  if (prevExternal !== external) {
    setPrevExternal(external)
    setDraft(external)
    setInvalid(false)
  }
  return (
    <div className="space-y-1">
      <input
        type="number"
        value={draft}
        placeholder={placeholder}
        onChange={event => {
          const raw = event.target.value
          setDraft(raw)
          if (raw === '') {
            setInvalid(false)
            return
          }
          const next = Number(raw)
          if (Number.isFinite(next)) {
            setInvalid(false)
            onChange(next)
          } else {
            setInvalid(true)
          }
        }}
        onBlur={() => {
          if (draft === '') setDraft(external)
        }}
        className={`${fieldClass} ${invalid ? 'border-error-100' : ''}`}
      />
      {draft === '' && external !== '' && <div className="text-[length:var(--fs-xs)] text-text-500">{tx('Empty input will not remove a saved value; enter a new number or Reset before saving.', '留空不会删除已保存值；请输入新数字，或保存前 Reset。', lang)}</div>}
      {invalid && <div className="text-[length:var(--fs-xs)] text-error-100">{tx('Must be a valid number.', '必须是有效数字。', lang)}</div>}
    </div>
  )
}

export function IntegerField({
  value,
  onChange,
  min,
  max,
  positive,
}: {
  value: unknown
  onChange: (value: number | undefined) => void
  min?: number
  max?: number
  positive?: boolean
}) {
  const lang = useLang()
  const numberValue = typeof value === 'number' ? value : undefined
  const external = numberValue !== undefined && Number.isFinite(numberValue) ? String(numberValue) : ''
  const [prevExternal, setPrevExternal] = useState(external)
  const [draft, setDraft] = useState(external)
  if (prevExternal !== external) {
    setPrevExternal(external)
    setDraft(external)
  }
  const parsed = draft === '' ? undefined : Number(draft)
  const invalid =
    parsed !== undefined &&
    (!Number.isFinite(parsed) || !Number.isInteger(parsed) || (positive && parsed <= 0) || (min !== undefined && parsed < min) || (max !== undefined && parsed > max))
  return (
    <div className="space-y-1">
      <input
        type="number"
        step={1}
        min={min ?? (positive ? 1 : undefined)}
        max={max}
        value={draft}
        onChange={event => {
          const raw = event.target.value
          setDraft(raw)
          if (raw === '') return
          const next = Number(raw)
          if (Number.isFinite(next)) onChange(next)
        }}
        onBlur={() => {
          if (draft === '') setDraft(external)
        }}
        className={`${fieldClass} ${invalid ? 'border-error-100' : ''}`}
      />
      {draft === '' && external !== '' && <div className="text-[length:var(--fs-xs)] text-text-500">{tx('Empty input will not remove a saved value; enter a new integer or Reset before saving.', '留空不会删除已保存值；请输入新整数，或保存前 Reset。', lang)}</div>}
      {invalid && (
        <div className="text-[length:var(--fs-xs)] text-error-100">
          {tx('Must be an integer in the allowed range.', '必须是允许范围内的整数。', lang)}
        </div>
      )}
    </div>
  )
}

export function PositiveIntegerField(props: { value: unknown; onChange: (value: number | undefined) => void }) {
  return <IntegerField {...props} positive />
}

export function PortField(props: { value: unknown; onChange: (value: number | undefined) => void }) {
  return <IntegerField {...props} min={1} max={65535} />
}

export function BoolField({ value, onChange }: { value: unknown; onChange: (value: boolean) => void }) {
  return (
    <div className="flex h-full items-center">
      <Toggle enabled={Boolean(value)} onChange={() => onChange(!value)} />
    </div>
  )
}

export function NumberOrFalseField({ value, onChange }: { value: unknown; onChange: (value: number | false | undefined) => void }) {
  const mode = value === false ? 'false' : 'number'
  return (
    <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
      <Select
        value={mode}
        options={[
          { value: 'number', label: 'number' },
          { value: 'false', label: 'false' },
        ]}
        onChange={next => onChange(next === 'false' ? false : typeof value === 'number' ? value : undefined)}
      />
      {mode === 'number' && <PositiveIntegerField value={value} onChange={onChange} />}
    </div>
  )
}

export function Select({
  value,
  options,
  onChange,
  placeholder,
  editable,
}: {
  value: unknown
  options: Choice[]
  onChange: (value: string) => void
  placeholder?: string
  editable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<React.CSSProperties>({})

  const current = value === undefined || value === null ? '' : String(value)
  const selected = options.find(option => option.value === current)
  const display = selected ? selected.label : current

  const query = open && editable ? draft : ''
  const filtered = options.filter(option => {
    if (!query) return true
    const q = query.toLowerCase()
    return option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q)
  })

  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const below = window.innerHeight - rect.bottom
    const openUp = below < 280 && rect.top > below
    const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 16)
    const left = Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8)
    setPos({
      left,
      width,
      maxWidth: 'calc(100vw - 16px)',
      ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(place)
    const onDown = (event: PointerEvent) => {
      if (triggerRef.current?.contains(event.target as Node)) return
      if (menuRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const onScroll = () => place()
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
      cancelAnimationFrame(raf)
    }
  }, [open, place])

  return (
    <div ref={triggerRef} className="relative min-w-0 flex-1">
      {editable && open ? (
        <input
          autoFocus
          value={draft}
          placeholder={display || placeholder}
          onChange={event => {
            setDraft(event.target.value)
            onChange(event.target.value)
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === 'Escape') setOpen(false)
          }}
          className={`${fieldClass} pr-9`}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(current)
            setOpen(o => !o)
          }}
          className={`${fieldClass} flex items-center justify-between gap-2 text-left ${
            display ? '' : 'text-text-500'
          }`}
        >
          <span className="truncate">{display || placeholder || tx('Select…', '选择…', '')}</span>
          <ChevronDownIcon size={14} className="shrink-0 text-text-400" />
        </button>
      )}
      {editable && open && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-500 hover:bg-bg-100"
        >
          <ChevronDownIcon size={14} />
        </button>
      )}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[400] max-h-64 overflow-y-auto rounded-xl border border-border-200/60 bg-bg-000 p-1 shadow-lg custom-scrollbar"
            style={pos}
          >
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-[length:var(--fs-xs)] text-text-500">{tx('No matches', '无匹配项', '')}</div>
            )}
            {filtered.map(option => (
              <button
                key={`${option.value}|${option.label}`}
                type="button"
                disabled={option.disabled}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[length:var(--fs-sm)] transition-colors disabled:opacity-40 ${
                  option.value === current ? 'bg-accent-main-100/12 text-accent-main-100' : 'text-text-200 hover:bg-bg-100'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.hint && <span className="block truncate text-[length:var(--fs-xs)] text-text-500">{option.hint}</span>}
                </span>
                {option.value === current && <CheckIcon size={14} className="shrink-0" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}

export function StringListField({
  value,
  onChange,
  placeholder,
  mono,
}: {
  value: unknown
  onChange: (value: string[]) => void
  placeholder?: string
  mono?: boolean
}) {
  const list = asStringArray(value)
  return (
    <div className="space-y-2">
      {list.map((item, index) => (
        <div key={index} className="flex min-w-0 gap-2">
          <input
            value={item}
            onChange={event => {
              const next = [...list]
              next[index] = event.target.value
              onChange(next)
            }}
            placeholder={placeholder}
            className={`${fieldClass} ${mono ? 'font-mono' : ''}`}
          />
          <button
            type="button"
            onClick={() => onChange(list.filter((_, i) => i !== index))}
            className="shrink-0 rounded-lg border border-border-200/60 px-2 text-text-500 hover:bg-bg-100 hover:text-error-100"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...list, ''])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border-200/60 px-3 py-1.5 text-[length:var(--fs-xs)] text-text-300 transition-colors hover:bg-bg-100"
      >
        <PlusIcon size={13} />
        {tx('Add', '添加', '')}
      </button>
    </div>
  )
}

type JsonValueType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null'

function jsonValueType(value: unknown): JsonValueType {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (isRecord(value)) return 'object'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'string'
}

function emptyJsonValue(type: JsonValueType): unknown {
  switch (type) {
    case 'number':
      return 0
    case 'boolean':
      return true
    case 'object':
      return {}
    case 'array':
      return []
    case 'null':
      return null
    case 'string':
      return ''
  }
}

export function JsonStructuredEditor({ value, type, onChange }: { value: unknown; type: 'object' | 'array'; onChange: (value: unknown) => void }) {
  const lang = useLang()
  const reportDraftError = useContext(JsonDraftErrorContext)
  const draftID = useRef<string | undefined>(undefined)
  if (!draftID.current) draftID.current = `json-draft-${++jsonDraftIDSeed}`
  const currentDraftID = draftID.current
  const [error, setError] = useState<string | null>(null)
  const text = JSON.stringify(value ?? emptyJsonValue(type), null, 2)
  const [draft, setDraft] = useState(text)
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(text)
    setError(null)
    reportDraftError(currentDraftID, false)
  }, [text, currentDraftID, reportDraftError])
  useEffect(() => () => reportDraftError(currentDraftID, false), [currentDraftID, reportDraftError])

  const parseDraft = (nextDraft: string) => {
    try {
      const next = JSON.parse(nextDraft)
      if (type === 'object' && !isRecord(next)) {
        const message = tx('Expected a JSON object.', '需要 JSON object。', lang)
        setError(message)
        reportDraftError(currentDraftID, true)
        return
      }
      if (type === 'array' && !Array.isArray(next)) {
        const message = tx('Expected a JSON array.', '需要 JSON array。', lang)
        setError(message)
        reportDraftError(currentDraftID, true)
        return
      }
      setError(null)
      reportDraftError(currentDraftID, false)
      return next
    } catch {
      setError(tx('Invalid JSON.', 'JSON 无效。', lang))
      reportDraftError(currentDraftID, true)
    }
    return undefined
  }
  return (
    <div className="space-y-1">
      <textarea
        value={draft}
        rows={Math.min(10, Math.max(4, draft.split('\n').length))}
        onFocus={() => {
          focused.current = true
        }}
        onChange={event => {
          const nextDraft = event.target.value
          setDraft(nextDraft)
          const next = parseDraft(nextDraft)
          if (next !== undefined) onChange(next)
        }}
        onBlur={() => {
          focused.current = false
          const next = parseDraft(draft)
          if (next !== undefined) {
            onChange(next)
            setDraft(JSON.stringify(next, null, 2))
          }
        }}
        className={`${fieldClass} resize-y font-mono leading-relaxed`}
      />
      {error && <div className="text-[length:var(--fs-xs)] text-error-100">{error}</div>}
    </div>
  )
}

function JsonValueEditor({ value, onChange, placeholder }: { value: unknown; onChange: (value: unknown) => void; placeholder?: string }) {
  const type = jsonValueType(value)
  switch (type) {
    case 'number':
      return <NumberField value={value} onChange={next => onChange(next ?? 0)} />
    case 'boolean':
      return <BoolField value={value} onChange={onChange} />
    case 'object':
    case 'array':
      return <JsonStructuredEditor value={value} type={type} onChange={onChange} />
    case 'null':
      return <input value="null" disabled className={`${fieldClass} text-text-500`} />
    case 'string':
      return <TextField value={value} onChange={onChange} placeholder={placeholder} mono />
  }
}

export function KeyValueField({
  value,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: {
  value: unknown
  onChange: (value: JsonRecord) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
}) {
  const lang = useLang()
  const record = isRecord(value) ? value : {}
  const [newKey, setNewKey] = useState('')
  const [newType, setNewType] = useState<JsonValueType>('string')
  const entries = Object.entries(record)
  const typeOptions = enumChoices(['string', 'number', 'boolean', 'object', 'array', 'null'])
  return (
    <div className="space-y-3">
      {entries.map(([key, item]) => {
        const type = jsonValueType(item)
        return (
          <div key={key} className="rounded-xl border border-border-200/45 bg-bg-000/25 p-2.5">
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 truncate rounded-lg border border-border-200/40 bg-bg-100/50 px-3 py-2 font-mono text-[length:var(--fs-xs)] text-text-300">
                {key}
              </div>
              <div className="flex min-w-0 items-center gap-2 sm:w-44">
                <Select value={type} options={typeOptions} onChange={next => onChange({ ...record, [key]: emptyJsonValue(next as JsonValueType) })} />
              </div>
            </div>
            <JsonValueEditor value={item} onChange={next => onChange({ ...record, [key]: next })} placeholder={valuePlaceholder} />
          </div>
        )
      })}
      <div className="rounded-xl border border-dashed border-border-200/55 bg-bg-000/15 p-2.5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={newKey}
            onChange={event => setNewKey(event.target.value)}
            placeholder={keyPlaceholder ?? tx('new key', '新键名', lang)}
            className={`${fieldClass} min-w-0 flex-1 font-mono`}
          />
          <div className="flex min-w-0 gap-2 sm:w-56">
            <Select value={newType} options={typeOptions} onChange={next => setNewType(next as JsonValueType)} />
            <button
              type="button"
              disabled={!newKey.trim() || newKey in record}
              onClick={() => {
                onChange({ ...record, [newKey.trim()]: emptyJsonValue(newType) })
                setNewKey('')
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-200/60 px-3 py-2 text-[length:var(--fs-xs)] text-text-300 transition-colors hover:bg-bg-100 disabled:opacity-40"
            >
              <PlusIcon size={13} />
              {tx('Add', '添加', lang)}
            </button>
          </div>
        </div>
      </div>
      <div className="text-[length:var(--fs-xs)] leading-relaxed text-text-500">
        {tx('Existing object keys cannot be reliably deleted through the official merge API; change values instead, or reset before saving newly added keys.', '官方 merge API 不能可靠删除已保存的 object key；请改值，刚新增但不想保存的键可以在保存前 Reset。', lang)}
      </div>
    </div>
  )
}

export function StringMapField({
  value,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: {
  value: unknown
  onChange: (value: Record<string, string>) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
}) {
  const lang = useLang()
  const record = isRecord(value) ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typeof item === 'string' ? item : String(item ?? '')])) : {}
  const [newKey, setNewKey] = useState('')
  return (
    <div className="space-y-3">
      {Object.entries(record).map(([key, item]) => (
        <div key={key} className="rounded-xl border border-border-200/45 bg-bg-000/25 p-2.5">
          <div className="mb-2 truncate rounded-lg border border-border-200/40 bg-bg-100/50 px-3 py-2 font-mono text-[length:var(--fs-xs)] text-text-300">
            {key}
          </div>
          <TextField value={item} onChange={next => onChange({ ...record, [key]: next })} placeholder={valuePlaceholder} mono />
        </div>
      ))}
      <div className="rounded-xl border border-dashed border-border-200/55 bg-bg-000/15 p-2.5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={newKey}
            onChange={event => setNewKey(event.target.value)}
            placeholder={keyPlaceholder ?? tx('new key', '新键名', lang)}
            className={`${fieldClass} min-w-0 flex-1 font-mono`}
          />
          <button
            type="button"
            disabled={!newKey.trim() || newKey in record}
            onClick={() => {
              onChange({ ...record, [newKey.trim()]: '' })
              setNewKey('')
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-200/60 px-3 py-2 text-[length:var(--fs-xs)] text-text-300 transition-colors hover:bg-bg-100 disabled:opacity-40"
          >
            <PlusIcon size={13} />
            {tx('Add', '添加', lang)}
          </button>
        </div>
      </div>
      <div className="text-[length:var(--fs-xs)] leading-relaxed text-text-500">
        {tx('This map only accepts string values. Existing keys cannot be reliably deleted through the official merge API.', '这个 map 只接受字符串值。官方 merge API 不能可靠删除已保存的 key。', lang)}
      </div>
    </div>
  )
}
