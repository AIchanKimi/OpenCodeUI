import { describe, expect, it } from 'vitest'
import { isRootDirectory, resolveFilePanelDirectory } from './directoryUtils'

describe('isRootDirectory', () => {
  it('detects unix and windows roots', () => {
    expect(isRootDirectory('/')).toBe(true)
    expect(isRootDirectory('///')).toBe(true)
    expect(isRootDirectory('C:/')).toBe(true)
    expect(isRootDirectory('C:\\')).toBe(true)
  })

  it('does not treat normal directories as roots', () => {
    expect(isRootDirectory('/workspace')).toBe(false)
    expect(isRootDirectory('C:/workspace')).toBe(false)
    expect(isRootDirectory(undefined)).toBe(false)
  })
})

describe('resolveFilePanelDirectory', () => {
  it('prefers the current directory when set', () => {
    expect(resolveFilePanelDirectory('/workspace/project')).toBe('/workspace/project')
  })

  it('falls back to unix root in global mode', () => {
    expect(resolveFilePanelDirectory(undefined)).toBe('/')
  })
})
