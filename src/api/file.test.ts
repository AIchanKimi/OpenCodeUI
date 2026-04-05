import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadDirectoryArchive, downloadFileAsset } from './file'

const getBinaryMock = vi.fn()

vi.mock('./http', () => ({
  get: vi.fn(),
  getBinary: (...args: unknown[]) => getBinaryMock(...args),
}))

vi.mock('../store/serverStore', () => ({
  serverStore: {
    getActiveServerId: () => 'test-server',
  },
}))

describe('downloadDirectoryArchive', () => {
  beforeEach(() => {
    getBinaryMock.mockReset()
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
})

describe('downloadFileAsset', () => {
  beforeEach(() => {
    getBinaryMock.mockReset()
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
})
