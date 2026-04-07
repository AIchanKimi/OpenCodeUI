import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  downloadDirectoryArchive,
  downloadFileAsset,
  getFileContent,
  getFileServiceAvailability,
  saveFileContent,
} from './file'

const getMock = vi.fn()
const getBinaryMock = vi.fn()
const unifiedFetchMock = vi.fn()
const putMock = vi.fn()

vi.mock('./http', () => ({
  get: (...args: unknown[]) => getMock(...args),
  getBinary: (...args: unknown[]) => getBinaryMock(...args),
  buildUrl: vi.fn((path: string) => `http://example.test${path}`),
  getAuthHeader: vi.fn(() => ({ Authorization: 'Basic test' })),
  put: (...args: unknown[]) => putMock(...args),
  unifiedFetch: (...args: unknown[]) => unifiedFetchMock(...args),
}))

vi.mock('../store/serverStore', () => ({
  serverStore: {
    getActiveServerId: () => 'test-server',
  },
}))

describe('downloadDirectoryArchive', () => {
  beforeEach(() => {
    getMock.mockReset()
    getBinaryMock.mockReset()
    unifiedFetchMock.mockReset()
    putMock.mockReset()
  })

  it('requests archive endpoint with formatted params and returns blob plus file name', async () => {
    getBinaryMock.mockResolvedValue(
      new Response('zip-data', {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="components.zip"',
        },
      }),
    )

    const result = await downloadDirectoryArchive('src/components', '/workspace/project')

    expect(getBinaryMock).toHaveBeenCalledWith(
      '/file/archive',
      {
        path: 'src/components',
        directory: '/workspace/project',
      },
      {
        signal: undefined,
        timeout: 0,
      },
    )
    expect(result.fileName).toBe('components.zip')
    expect(result.blob.type).toBe('application/zip')
    await expect(result.blob.text()).resolves.toBe('zip-data')
  })

  it('falls back to the directory name when content disposition is missing', async () => {
    getBinaryMock.mockResolvedValue(
      new Response('zip-data', { status: 200, headers: { 'Content-Type': 'application/zip' } }),
    )

    const result = await downloadDirectoryArchive('nested/path/assets', '/workspace/project')

    expect(result.fileName).toBe('assets.zip')
  })

  it('rewrites legacy docker workspace prefix before requesting archive download', async () => {
    getBinaryMock.mockResolvedValue(
      new Response('zip-data', {
        status: 200,
        headers: { 'Content-Type': 'application/zip' },
      }),
    )

    await downloadDirectoryArchive('src', '/root/workspace/project')

    expect(getBinaryMock).toHaveBeenCalledWith(
      '/file/archive',
      {
        path: 'src',
        directory: '/workspace/project',
      },
      {
        signal: undefined,
        timeout: 0,
      },
    )
  })
})

describe('getFileServiceAvailability', () => {
  beforeEach(() => {
    getBinaryMock.mockReset()
    unifiedFetchMock.mockReset()
    putMock.mockReset()
  })

  it('returns true when file service health endpoint responds ok', async () => {
    unifiedFetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }))

    await expect(getFileServiceAvailability(true)).resolves.toBe(true)
    expect(unifiedFetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns false when file service health endpoint is unavailable', async () => {
    unifiedFetchMock.mockResolvedValue(new Response('not found', { status: 404 }))

    await expect(getFileServiceAvailability(true)).resolves.toBe(false)
  })

  it('returns false when endpoint responds with non-json html shell', async () => {
    unifiedFetchMock.mockResolvedValue(
      new Response('<!doctype html><html><body>app</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    )

    await expect(getFileServiceAvailability(true)).resolves.toBe(false)
  })
})

describe('downloadFileAsset', () => {
  beforeEach(() => {
    getMock.mockReset()
    getBinaryMock.mockReset()
    putMock.mockReset()
  })

  it('requests file download endpoint and returns original filename', async () => {
    getBinaryMock.mockResolvedValue(
      new Response('hello world', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': 'attachment; filename="README.md"',
        },
      }),
    )

    const result = await downloadFileAsset('README.md', '/workspace/project')

    expect(getBinaryMock).toHaveBeenCalledWith(
      '/file/download',
      {
        path: 'README.md',
        directory: '/workspace/project',
      },
      {
        signal: undefined,
        timeout: 0,
      },
    )
    expect(result.fileName).toBe('README.md')
    expect(result.blob.type).toBe('text/plain;charset=utf-8')
    await expect(result.blob.text()).resolves.toBe('hello world')
  })

  it('falls back to path basename when content disposition is missing', async () => {
    getBinaryMock.mockResolvedValue(
      new Response('hello world', { status: 200, headers: { 'Content-Type': 'application/octet-stream' } }),
    )

    const result = await downloadFileAsset('nested/path/config.json', '/workspace/project')

    expect(result.fileName).toBe('config.json')
  })

  it('rewrites legacy docker workspace prefix before requesting file download', async () => {
    getBinaryMock.mockResolvedValue(
      new Response('hello world', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }),
    )

    await downloadFileAsset('README.md', '/root/workspace/project')

    expect(getBinaryMock).toHaveBeenCalledWith(
      '/file/download',
      {
        path: 'README.md',
        directory: '/workspace/project',
      },
      {
        signal: undefined,
        timeout: 0,
      },
    )
  })

  it('maps root workspace child paths before requesting file download', async () => {
    getBinaryMock.mockResolvedValue(
      new Response('hello world', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }),
    )

    await downloadFileAsset('workspace/demo/test.txt', '/root')

    expect(getBinaryMock).toHaveBeenCalledWith(
      '/file/download',
      {
        path: 'demo/test.txt',
        directory: '/workspace',
      },
      {
        signal: undefined,
        timeout: 0,
      },
    )
  })
})

describe('getFileContent', () => {
  beforeEach(() => {
    getMock.mockReset()
    getBinaryMock.mockReset()
    putMock.mockReset()
  })

  it('rewrites legacy docker workspace prefix before requesting file content', async () => {
    getMock.mockResolvedValue({ type: 'text', content: 'hello', mimeType: 'text/plain' })

    await getFileContent('README.md', '/root/workspace/project')

    expect(getMock).toHaveBeenCalledWith('/file/content', {
      path: 'README.md',
      directory: '/workspace/project',
    })
  })

  it('rewrites the exact legacy docker workspace root', async () => {
    getMock.mockResolvedValue({ type: 'text', content: 'hello', mimeType: 'text/plain' })

    await getFileContent('README.md', '/root/workspace')

    expect(getMock).toHaveBeenCalledWith('/file/content', {
      path: 'README.md',
      directory: '/workspace',
    })
  })

  it('maps root workspace child paths into the file-service workspace', async () => {
    getMock.mockResolvedValue({ type: 'text', content: 'hello', mimeType: 'text/plain' })

    await getFileContent('workspace/demo/test.txt', '/root')

    expect(getMock).toHaveBeenCalledWith('/file/content', {
      path: 'demo/test.txt',
      directory: '/workspace',
    })
  })

  it('preserves non-docker paths and undefined directory values', async () => {
    getMock.mockResolvedValue({ type: 'text', content: 'hello', mimeType: 'text/plain' })

    await getFileContent('README.md', '/Users/aichan/project')
    await getFileContent('README.md')

    expect(getMock).toHaveBeenNthCalledWith(1, '/file/content', {
      path: 'README.md',
      directory: '/Users/aichan/project',
    })
    expect(getMock).toHaveBeenNthCalledWith(2, '/file/content', {
      path: 'README.md',
      directory: undefined,
    })
  })

  it('falls back to the legacy backend preview route for unsupported root paths', async () => {
    getMock.mockResolvedValue({ type: 'text', content: 'outside root file', mimeType: 'text/plain' })

    await getFileContent('outside.txt', '/root')

    expect(getMock).toHaveBeenCalledWith('/backend/file/content', {
      path: 'outside.txt',
      directory: '/root',
    })
  })
})

describe('saveFileContent', () => {
  beforeEach(() => {
    getMock.mockReset()
    getBinaryMock.mockReset()
    putMock.mockReset()
  })

  it('writes file content with optimistic concurrency payload', async () => {
    putMock.mockResolvedValue({
      path: 'README.md',
      savedAt: '2026-04-05T00:00:00.000Z',
    })

    const result = await saveFileContent('README.md', '# updated', '/workspace/project', {
      expectedContent: '# old',
    })

    expect(putMock).toHaveBeenCalledWith(
      '/file/content',
      {
        path: 'README.md',
        directory: '/workspace/project',
      },
      {
        content: '# updated',
        expectedContent: '# old',
      },
    )
    expect(result).toEqual({
      path: 'README.md',
      savedAt: '2026-04-05T00:00:00.000Z',
    })
  })

  it('rewrites legacy docker workspace prefix before saving file content', async () => {
    putMock.mockResolvedValue({
      path: 'README.md',
      savedAt: '2026-04-05T00:00:00.000Z',
    })

    await saveFileContent('README.md', '# updated', '/root/workspace/project')

    expect(putMock).toHaveBeenCalledWith(
      '/file/content',
      {
        path: 'README.md',
        directory: '/workspace/project',
      },
      {
        content: '# updated',
        expectedContent: undefined,
      },
    )
  })
})
