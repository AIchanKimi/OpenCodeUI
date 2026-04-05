import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob } from './downloadUtils'

vi.mock('./tauri', () => ({
  isTauri: () => false,
}))

describe('downloadBlob', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    vi.useFakeTimers()
    URL.createObjectURL = vi.fn(() => 'blob:test-url')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('creates a browser download link and revokes the object url', () => {
    const clickMock = vi.fn()
    const appendChildSpy = vi.spyOn(document.body, 'appendChild')
    const removeChildSpy = vi.spyOn(document.body, 'removeChild')
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(tagName => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName)
      if (tagName === 'a') {
        Object.defineProperty(element, 'click', {
          value: clickMock,
          configurable: true,
        })
      }
      return element as HTMLAnchorElement
    })

    downloadBlob(new Blob(['zip-data'], { type: 'application/zip' }), 'archive.zip')

    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(appendChildSpy).toHaveBeenCalledTimes(1)
    const link = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement
    expect(link.download).toBe('archive.zip')
    expect(link.href).toBe('blob:test-url')
    expect(clickMock).toHaveBeenCalledTimes(1)

    vi.runAllTimers()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url')
    expect(removeChildSpy).toHaveBeenCalledWith(link)
  })
})
