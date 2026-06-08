import { DrillChild } from './configEditorDrill'
import { useDrillContainer } from './configEditorDrillState'
import { buildAgentConfigFields } from './configEditorAgentFields'
import { DrillFields, NamedDrillList, SectionShell } from './configEditorFields'
import type { SectionProps } from './configEditorSectionTypes'
import type { JsonRecord } from './configEditorTypes'
import { getObject, isRecord, setNested, tx } from './configEditorUtils'

export function AgentsSection(props: SectionProps) {
  return (
    <SectionShell id="agents" lang={props.lang}>
      <AgentsHome {...props} />
    </SectionShell>
  )
}

function AgentsHome({ config, setConfig, lang, models }: SectionProps) {
  const { activeChildId, enter, depth } = useDrillContainer()
  const builtins = ['build', 'plan', 'general', 'explore', 'title', 'summary', 'compaction']
  const map = getObject(config, 'agent')
  const names = Array.from(new Set([...Object.keys(map)])).sort()
  const selected = activeChildId?.startsWith('agent:') ? activeChildId.slice('agent:'.length) : ''
  const item = getObject(config, 'agent')[selected]
  const value = isRecord(item) ? item : {}
  const set = (next: JsonRecord) => setConfig(setNested(config, ['agent', selected], next))
  const setField = (key: string, v: unknown) => set({ ...value, [key]: v })
  const fields = selected ? buildAgentConfigFields({ value, setField, lang, models }) : []
  if (selected) {
    return (
      <DrillChild depth={depth}>
        <DrillFields fields={fields} isConfigured={key => key in value} lang={lang} />
      </DrillChild>
    )
  }

  return (
    <NamedDrillList
      lang={lang}
      items={names}
      addPlaceholder={tx('agent name', 'agent 名称', lang)}
      onOpen={name => enter({ id: `agent:${name}`, title: name })}
      onAdd={name => setConfig(setNested(config, ['agent', name], {}))}
      builtins={builtins}
      renderPreview={name => (isRecord(map[name]) ? String((map[name] as JsonRecord).description ?? '') : '')}
      emptyText={tx('Add an agent name (e.g. build) to override it.', '添加一个 agent 名称（如 build）即可覆盖。', lang)}
    />
  )
}
