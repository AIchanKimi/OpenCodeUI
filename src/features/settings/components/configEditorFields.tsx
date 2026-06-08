import { useContext, useState } from 'react'
import type React from 'react'
import { ChevronRightIcon, PlusIcon } from '../../../components/Icons'
import { Drill, DrillChild, DrillRow } from './configEditorDrill'
import { useDrillContainer, ValidationDrillTargetContext } from './configEditorDrillState'
import { SECTION_META } from './configEditorMeta'
import type { Lang, SectionID } from './configEditorTypes'
import { fieldClass } from './configEditorControls'
import { tx } from './configEditorUtils'

export type FieldDef = {
  key: string
  label: string
  desc?: string
  badge?: string
  block?: boolean
  drill?: { title: string; preview?: string; render: () => React.ReactNode }
  control?: React.ReactNode
}

export function FieldRow({
  label,
  desc,
  badge,
  block,
  control,
  onFocus,
  onBlur,
}: Omit<FieldDef, 'key'> & {
  onFocus?: React.FocusEventHandler<HTMLDivElement>
  onBlur?: React.FocusEventHandler<HTMLDivElement>
}) {
  if (block) {
    return (
      <div className="border-b border-border-200/35 py-3.5 last:border-b-0" onFocus={onFocus} onBlur={onBlur}>
        <div className="mb-2 min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 break-all font-mono text-[length:var(--fs-sm)] font-medium text-text-100">{label}</span>
            {badge && (
              <span className="rounded bg-warning-100/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-warning-100">{badge}</span>
            )}
          </div>
          {desc && <div className="mt-1 text-[length:var(--fs-xs)] leading-relaxed text-text-400">{desc}</div>}
        </div>
        <div className="min-w-0">{control}</div>
      </div>
    )
  }
  return (
    <div className="grid gap-2 border-b border-border-200/35 py-3.5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(240px,340px)] md:items-start md:gap-5" onFocus={onFocus} onBlur={onBlur}>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 break-all font-mono text-[length:var(--fs-sm)] font-medium text-text-100">{label}</span>
          {badge && (
            <span className="rounded bg-warning-100/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-warning-100">{badge}</span>
          )}
        </div>
        {desc && <div className="mt-1 text-[length:var(--fs-xs)] leading-relaxed text-text-400">{desc}</div>}
      </div>
      <div className="min-w-0">{control}</div>
    </div>
  )
}

export function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border-200/50 bg-bg-000/30 px-3 py-5 text-center text-[length:var(--fs-sm)] text-text-500">
      {text}
    </div>
  )
}

function FieldRenderer({
  field,
  onEnter,
  onFieldFocus,
  onFieldBlur,
}: {
  field: FieldDef
  onEnter: (field: FieldDef) => void
  onFieldFocus?: (field: FieldDef) => void
  onFieldBlur?: (fieldKey: string, currentTarget: HTMLElement, relatedTarget: EventTarget | null) => void
}) {
  const handleFocus = () => onFieldFocus?.(field)
  const handleBlur = (event: React.FocusEvent<HTMLElement>) => onFieldBlur?.(field.key, event.currentTarget, event.relatedTarget)
  if (field.drill) {
    const d = field.drill
    return <DrillRow label={field.label} desc={field.desc} badge={field.badge} preview={d.preview} onClick={() => onEnter(field)} onFocus={handleFocus} onBlur={handleBlur} />
  }
  return <FieldRow label={field.label} desc={field.desc} badge={field.badge} block={field.block} control={field.control} onFocus={handleFocus} onBlur={handleBlur} />
}

export function GroupedFields({
  fields,
  isConfigured,
  lang,
  onEnter,
}: {
  fields: FieldDef[]
  isConfigured: (key: string) => boolean
  lang: Lang
  onEnter?: (field: FieldDef) => void
}) {
  const handleEnter = onEnter ?? (() => {})
  const [focusedField, setFocusedField] = useState<{ key: string; group: 'configured' | 'available' } | null>(null)
  const focusedAvailableKey = focusedField?.group === 'available' ? focusedField.key : null
  const configured = fields.filter(field => isConfigured(field.key) && field.key !== focusedAvailableKey)
  const available = fields.filter(field => !isConfigured(field.key) || field.key === focusedAvailableKey)
  const handleFieldFocus = (field: FieldDef) => {
    const group = isConfigured(field.key) ? 'configured' : 'available'
    setFocusedField(prev => (prev?.key === field.key && prev.group === group ? prev : { key: field.key, group }))
  }
  const handleFieldBlur = (fieldKey: string, currentTarget: HTMLElement, relatedTarget: EventTarget | null) => {
    if (relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) return
    setFocusedField(prev => (prev?.key === fieldKey ? null : prev))
  }
  return (
    <div className="space-y-5">
      <div>
        <GroupHeader text={tx('Configured', '已配置', lang)} count={configured.length} accent />
        {configured.length === 0 ? (
          <EmptyHint text={tx('No fields configured yet.', '还没有配置任何字段。', lang)} />
        ) : (
          <div className="rounded-xl border border-border-200/45 bg-bg-000/25 px-3.5">
            {configured.map(field => (
              <FieldRenderer key={field.key} field={field} onEnter={handleEnter} onFieldFocus={handleFieldFocus} onFieldBlur={handleFieldBlur} />
            ))}
          </div>
        )}
      </div>
      <div>
        <GroupHeader text={tx('Available', '可配置', lang)} count={available.length} />
        {available.length === 0 ? (
          <EmptyHint text={tx('All fields are configured.', '全部字段都已配置。', lang)} />
        ) : (
          <div className="rounded-xl border border-border-200/45 bg-bg-000/15 px-3.5">
            {available.map(field => (
              <FieldRenderer key={field.key} field={field} onEnter={handleEnter} onFieldFocus={handleFieldFocus} onFieldBlur={handleFieldBlur} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function GroupHeader({ text, count, accent }: { text: string; count: number; accent?: boolean }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className={`text-[length:var(--fs-xs)] font-semibold uppercase tracking-wide ${accent ? 'text-accent-main-100' : 'text-text-500'}`}>
        {text}
      </span>
      <span className="rounded-full bg-bg-100 px-1.5 text-[10px] text-text-500">{count}</span>
    </div>
  )
}

export function DrillFields({ fields, isConfigured, lang }: { fields: FieldDef[]; isConfigured: (key: string) => boolean; lang: Lang }) {
  const { activeChildId, enter, depth } = useDrillContainer()
  if (activeChildId) {
    const active = fields.find(field => field.drill && field.key === activeChildId)
    if (active?.drill) return <DrillChild depth={depth}>{active.drill.render()}</DrillChild>
  }
  return (
    <GroupedFields
      fields={fields}
      isConfigured={isConfigured}
      lang={lang}
      onEnter={field => field.drill && enter({ id: field.key, title: field.drill.title })}
    />
  )
}

export function SectionShell({ id, lang, drillKey, children }: { id: SectionID; lang: Lang; drillKey?: string; children: React.ReactNode }) {
  const meta = SECTION_META[id]
  const target = useContext(ValidationDrillTargetContext)
  const activeTarget = target?.section === id ? target : null
  return (
    <div className="min-w-0">
      <div className="mb-4">
        <h3 className="text-[length:var(--fs-heading-2)] font-semibold text-text-100">{tx(meta.en, meta.zh, lang)}</h3>
        <p className="mt-1 text-[length:var(--fs-sm)] leading-relaxed text-text-400">{tx(meta.descEn, meta.descZh, lang)}</p>
      </div>
      <Drill rootTitle={tx(meta.en, meta.zh, lang)} rootKey={drillKey ?? id} targetKey={activeTarget?.key} targetStack={activeTarget?.stack}>
        {children}
      </Drill>
    </div>
  )
}

export function NamedDrillList({
  lang,
  items,
  addPlaceholder,
  onOpen,
  onAdd,
  builtins,
  renderPreview,
  emptyText,
}: {
  lang: Lang
  items: string[]
  addPlaceholder: string
  onOpen: (name: string) => void
  onAdd: (name: string) => void
  builtins?: string[]
  renderPreview?: (name: string) => string
  emptyText?: string
}) {
  const [newName, setNewName] = useState('')
  const add = () => {
    const name = newName.trim()
    if (!name) return
    onAdd(name)
    onOpen(name)
    setNewName('')
  }
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <EmptyHint text={emptyText ?? tx('No items yet.', '还没有条目。', lang)} />
      ) : (
        <div className="rounded-xl border border-border-200/45 bg-bg-000/25 px-3.5">
          {items.map(name => (
            <div key={name} className="group flex items-center gap-2 border-b border-border-200/35 last:border-b-0">
              <button type="button" onClick={() => onOpen(name)} className="flex min-w-0 flex-1 items-center gap-3 py-3.5 text-left">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[length:var(--fs-sm)] font-medium text-text-100">
                    {name}
                    {builtins?.includes(name) && (
                      <span className="ml-1.5 text-[10px] uppercase text-text-500">{tx('built-in', '内置', lang)}</span>
                    )}
                  </div>
                  {renderPreview && <div className="truncate text-[length:var(--fs-xs)] text-text-500">{renderPreview(name)}</div>}
                </div>
                <ChevronRightIcon size={15} className="shrink-0 text-text-500 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex min-w-0 gap-2">
        <input
          value={newName}
          onChange={event => setNewName(event.target.value)}
          placeholder={addPlaceholder}
          onKeyDown={event => {
            if (event.key === 'Enter') add()
          }}
          className={`${fieldClass} min-w-0 flex-1 font-mono`}
        />
        <button
          type="button"
          disabled={!newName.trim()}
          onClick={add}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-200/60 px-3 text-[length:var(--fs-xs)] text-text-300 hover:bg-bg-100 disabled:opacity-40"
        >
          <PlusIcon size={14} />
          {tx('Add', '添加', lang)}
        </button>
      </div>
    </div>
  )
}
