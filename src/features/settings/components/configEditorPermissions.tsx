import { useState } from 'react'
import { PlusIcon } from '../../../components/Icons'
import { Toggle } from './SettingsUI'
import { DrillChild, DrillRow } from './configEditorDrill'
import { useDrillContainer } from './configEditorDrillState'
import { fieldClass, Select } from './configEditorControls'
import { GroupHeader, SectionShell } from './configEditorFields'
import { PERMISSION_ACTIONS, PERMISSION_TOOLS } from './configEditorMeta'
import { enumChoices, type SectionProps } from './configEditorSectionTypes'
import type { JsonRecord, Lang } from './configEditorTypes'
import { isRecord, previewValue, setRoot, tx, useLang } from './configEditorUtils'

export function PermissionEditor({ value, onChange, lang }: { value: unknown; onChange: (value: unknown) => void; lang: Lang }) {
  const { activeChildId, enter, depth } = useDrillContainer()
  const [newTool, setNewTool] = useState('')
  const globalMode = typeof value === 'string'
  const record = isRecord(value) ? value : {}
  const knownTools = new Set(PERMISSION_TOOLS.map(item => item.tool))
  const customTools = Object.keys(record).filter(tool => !knownTools.has(tool)).sort()

  if (activeChildId?.startsWith('permission-patterns:')) {
    const tool = activeChildId.slice('permission-patterns:'.length)
    const current = record[tool]
    if (isRecord(current)) {
      return (
        <DrillChild depth={depth}>
          <PatternRules value={current as JsonRecord} onChange={next => onChange({ ...record, [tool]: next })} lang={lang} />
        </DrillChild>
      )
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border-200/40 bg-bg-000/30 p-2">
        <span className="min-w-0 flex-1 text-[length:var(--fs-xs)] text-text-400">{tx('Apply one action to everything', '对所有工具应用同一动作', lang)}</span>
        <Select
          value={globalMode ? String(value) : ''}
          options={[{ value: '', label: tx('per-tool', '按工具', lang) }, ...enumChoices(PERMISSION_ACTIONS)]}
          onChange={next => onChange(next === '' ? {} : next)}
        />
      </div>
      {!globalMode &&
        PERMISSION_TOOLS.map(({ tool, pattern, en, zh }) => {
          const current = record[tool]
          const isPatternMap = isRecord(current)
          const simple = typeof current === 'string' ? current : ''
          return (
            <div key={tool} className="rounded-lg border border-border-200/40 bg-bg-000/30 p-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[length:var(--fs-sm)] text-text-200">{tool}</div>
                  <div className="text-[length:var(--fs-xs)] text-text-500">{tx(en, zh, lang)}</div>
                </div>
                <div className="w-32 shrink-0">
                  <Select
                    value={isPatternMap ? '__pattern__' : simple}
                    options={[
                      ...(!(tool in record) ? [{ value: '', label: tx('inherit', '继承', lang) }] : []),
                      ...enumChoices(PERMISSION_ACTIONS),
                      ...(pattern ? [{ value: '__pattern__', label: tx('by pattern…', '按 pattern…', lang) }] : []),
                    ]}
                    onChange={next => {
                      if (next === '__pattern__') {
                        onChange({ ...record, [tool]: isPatternMap ? current : { '*': 'ask' } })
                      } else if (next !== '') {
                        onChange({ ...record, [tool]: next })
                      }
                    }}
                  />
                </div>
              </div>
              {isPatternMap && (
                <div className="mt-2 border-t border-border-200/40 pt-2">
                  <DrillRow
                    label="patterns"
                    desc={tx('Pattern-specific permission rules for this tool.', '该工具按 pattern 细分的权限规则。', lang)}
                    preview={previewValue(current, lang)}
                    onClick={() => enter({ id: `permission-patterns:${tool}`, title: `${tool}.patterns` })}
                  />
                </div>
              )}
            </div>
          )
        })}
      {!globalMode && customTools.length > 0 && (
        <div className="pt-2">
          <GroupHeader text={tx('Custom tools', '自定义工具', lang)} count={customTools.length} />
          <div className="space-y-2">
            {customTools.map(tool => {
              const current = record[tool]
              const isPatternMap = isRecord(current)
              const simple = typeof current === 'string' ? current : ''
              return (
                <div key={tool} className="rounded-lg border border-border-200/40 bg-bg-000/30 p-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[length:var(--fs-sm)] text-text-200">{tool}</div>
                      <div className="text-[length:var(--fs-xs)] text-text-500">{tx('Custom tool permission key.', '自定义工具权限 key。', lang)}</div>
                    </div>
                    <div className="w-32 shrink-0">
                      <Select
                        value={isPatternMap ? '__pattern__' : simple}
                        options={[...enumChoices(PERMISSION_ACTIONS), { value: '__pattern__', label: tx('by pattern…', '按 pattern…', lang) }]}
                        onChange={next => {
                          if (next === '__pattern__') onChange({ ...record, [tool]: isPatternMap ? current : { '*': 'ask' } })
                          else onChange({ ...record, [tool]: next })
                        }}
                      />
                    </div>
                  </div>
                  {isPatternMap && (
                    <div className="mt-2 border-t border-border-200/40 pt-2">
                      <DrillRow
                        label="patterns"
                        desc={tx('Pattern-specific permission rules for this custom tool.', '该自定义工具按 pattern 细分的权限规则。', lang)}
                        preview={previewValue(current, lang)}
                        onClick={() => enter({ id: `permission-patterns:${tool}`, title: `${tool}.patterns` })}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {!globalMode && (
        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <input value={newTool} onChange={event => setNewTool(event.target.value)} placeholder={tx('custom tool key', '自定义工具 key', lang)} className={`${fieldClass} min-w-0 flex-1 font-mono`} />
          <button
            type="button"
            disabled={!newTool.trim() || newTool in record}
            onClick={() => {
              onChange({ ...record, [newTool.trim()]: 'ask' })
              setNewTool('')
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-200/60 px-3 py-2 text-[length:var(--fs-xs)] text-text-300 hover:bg-bg-100 disabled:opacity-40"
          >
            <PlusIcon size={13} />
            {tx('Add', '添加', lang)}
          </button>
        </div>
      )}
    </div>
  )
}

function PatternRules({ value, onChange, lang }: { value: JsonRecord; onChange: (value: JsonRecord) => void; lang: Lang }) {
  const [newPattern, setNewPattern] = useState('')
  return (
    <div className="space-y-2">
      {Object.entries(value).map(([pattern, action]) => (
        <div key={pattern} className="flex min-w-0 items-center gap-2">
          <div className={`${fieldClass} min-w-0 flex-1 truncate font-mono text-text-300`}>{pattern}</div>
          <div className="w-28 shrink-0">
            <Select value={action} options={enumChoices(PERMISSION_ACTIONS)} onChange={next => onChange({ ...value, [pattern]: next })} />
          </div>
        </div>
      ))}
      <div className="flex min-w-0 gap-2">
        <input value={newPattern} onChange={event => setNewPattern(event.target.value)} placeholder={tx('pattern, e.g. git push *', 'pattern，如 git push *', lang)} className={`${fieldClass} min-w-0 flex-1 font-mono`} />
        <button type="button" disabled={!newPattern.trim()} onClick={() => { onChange({ ...value, [newPattern.trim()]: 'ask' }); setNewPattern('') }} className="rounded-lg border border-border-200/60 px-2.5 text-text-300 hover:bg-bg-100 disabled:opacity-40">
          <PlusIcon size={14} />
        </button>
      </div>
      <div className="text-[length:var(--fs-xs)] leading-relaxed text-text-500">
        {tx('Existing pattern keys cannot be reliably deleted or renamed through the official merge API. Change the action instead.', '官方 merge API 不能可靠删除或重命名已保存的 pattern key。请修改动作。', lang)}
      </div>
    </div>
  )
}

export function PermissionsSection({ config, setConfig, lang }: SectionProps) {
  return (
    <SectionShell id="permissions" lang={lang}>
      <p className="mb-3 text-[length:var(--fs-xs)] leading-relaxed text-text-400">
        {tx(
          'ask = prompt every time, allow = run without asking, deny = block. Pattern rules let you match specific commands or paths (e.g. "git push *").',
          'ask = 每次询问，allow = 直接放行，deny = 拒绝。pattern 规则可匹配具体命令或路径（如 "git push *"）。',
          lang,
        )}
      </p>
      <PermissionEditor value={(config as JsonRecord).permission} onChange={v => setConfig(setRoot(config, 'permission', v))} lang={lang} />
    </SectionShell>
  )
}

export function ToolToggleMap({ value, onChange }: { value: unknown; onChange: (value: JsonRecord) => void }) {
  const lang = useLang()
  const record = isRecord(value) ? value : {}
  const [newKey, setNewKey] = useState('')
  return (
    <div className="space-y-2">
      {Object.entries(record).map(([tool, enabled]) => (
        <div key={tool} className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-mono text-[length:var(--fs-sm)] text-text-200">{tool}</span>
          <Toggle enabled={Boolean(enabled)} onChange={() => onChange({ ...record, [tool]: !enabled })} />
        </div>
      ))}
      <div className="flex min-w-0 gap-2">
        <input value={newKey} onChange={event => setNewKey(event.target.value)} placeholder="tool name" className={`${fieldClass} min-w-0 flex-1 font-mono`} />
        <button type="button" disabled={!newKey.trim()} onClick={() => { onChange({ ...record, [newKey.trim()]: true }); setNewKey('') }} className="rounded-lg border border-border-200/60 px-2.5 text-text-300 hover:bg-bg-100 disabled:opacity-40">
          <PlusIcon size={14} />
        </button>
      </div>
      <div className="text-[length:var(--fs-xs)] leading-relaxed text-text-500">
        {tx('Existing tool keys cannot be reliably deleted through the official merge API. Toggle them instead.', '官方 merge API 不能可靠删除已保存的 tool key。请改为切换启用状态。', lang)}
      </div>
    </div>
  )
}
