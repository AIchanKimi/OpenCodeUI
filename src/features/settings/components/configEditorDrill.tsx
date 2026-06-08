import { useState } from 'react'
import type React from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '../../../components/Icons'
import { DrillContext, DrillDepthContext, type DrillEntry, type DrillState } from './configEditorDrillState'
import { tx, useLang } from './configEditorUtils'

export function Drill({ rootTitle, rootKey, targetKey, targetStack, children }: { rootTitle: string; rootKey: string; targetKey?: string; targetStack?: DrillEntry[]; children: React.ReactNode }) {
  const [stack, setStack] = useState<DrillEntry[]>(targetStack ?? [])
  const [prevRootKey, setPrevRootKey] = useState(rootKey)
  const [prevTargetKey, setPrevTargetKey] = useState(targetKey)
  const lang = useLang()

  if (prevRootKey !== rootKey || prevTargetKey !== targetKey) {
    setPrevRootKey(rootKey)
    setPrevTargetKey(targetKey)
    setStack(targetStack ?? [])
  }
  const liveStack = prevRootKey !== rootKey || prevTargetKey !== targetKey ? targetStack ?? [] : stack

  const api: DrillState = {
    stack: liveStack,
    push: entry => setStack(prev => [...prev, entry]),
    back: toIndex => setStack(prev => prev.slice(0, toIndex)),
    replace: (index, entry) => setStack(prev => [...prev.slice(0, index), entry]),
  }

  const trail = [{ id: '__root__', title: rootTitle }, ...liveStack]

  return (
    <DrillContext.Provider value={api}>
      <DrillDepthContext.Provider value={0}>
        <div className="min-w-0">
          {liveStack.length > 0 && (
            <div className="mb-3 flex items-start gap-2 border-b border-border-200/40 pb-2.5">
              <button
                type="button"
                onClick={() => api.back(liveStack.length - 1)}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-border-200/60 px-2 py-1 text-[length:var(--fs-xs)] text-text-300 transition-colors hover:bg-bg-100"
              >
                <ChevronLeftIcon size={13} />
                {tx('Back', '返回', lang)}
              </button>
              <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-[length:var(--fs-xs)]">
                {trail.map((frame, index) => {
                  const isLast = index === trail.length - 1
                  return (
                    <span key={frame.id} className="flex min-w-0 max-w-full items-center gap-1">
                      {index > 0 && <ChevronRightIcon size={11} className="text-text-500" />}
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => api.back(index)}
                        className={`min-w-0 max-w-[180px] truncate rounded px-1 font-mono ${isLast ? 'text-text-200' : 'text-accent-main-100 hover:underline'}`}
                      >
                        {frame.title}
                      </button>
                    </span>
                  )
                })}
              </nav>
            </div>
          )}
          {children}
        </div>
      </DrillDepthContext.Provider>
    </DrillContext.Provider>
  )
}

export function DrillChild({ depth, children }: { depth: number; children: React.ReactNode }) {
  return <DrillDepthContext.Provider value={depth + 1}>{children}</DrillDepthContext.Provider>
}

export function DrillRow({
  label,
  desc,
  preview,
  badge,
  onClick,
  onFocus,
  onBlur,
}: {
  label: string
  desc?: string
  preview?: string
  badge?: string
  onClick: () => void
  onFocus?: React.FocusEventHandler<HTMLButtonElement>
  onBlur?: React.FocusEventHandler<HTMLButtonElement>
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
      className="group flex w-full items-center gap-3 border-b border-border-200/35 py-3.5 text-left last:border-b-0"
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 break-all font-mono text-[length:var(--fs-sm)] font-medium text-text-100">{label}</span>
          {badge && <span className="rounded bg-warning-100/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-warning-100">{badge}</span>}
        </div>
        {desc && <div className="mt-1 text-[length:var(--fs-xs)] leading-relaxed text-text-400">{desc}</div>}
      </div>
      {preview && <span className="shrink-0 max-w-[40%] truncate text-[length:var(--fs-xs)] text-text-500">{preview}</span>}
      <ChevronRightIcon size={15} className="shrink-0 text-text-500 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}
