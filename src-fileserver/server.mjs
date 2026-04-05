import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { lstat, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import http from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path'

const port = Number(process.env.FILE_SERVICE_PORT || '4097')
const basePath = resolve(process.env.FILE_SERVICE_BASE_PATH || '/workspace')
const authUser = process.env.OPENCODE_SERVER_USERNAME || 'opencode'
const authPassword = process.env.OPENCODE_SERVER_PASSWORD || ''
const maxConcurrentArchives = Number(process.env.FILE_SERVICE_MAX_CONCURRENT_ARCHIVES || '3')
const archiveTimeoutMs = Number(process.env.FILE_SERVICE_ARCHIVE_TIMEOUT_MS || '60000')
const maxErrorOutput = Number(process.env.FILE_SERVICE_MAX_ERROR_OUTPUT || '4096')
const maxRequestBodyBytes = Number(process.env.FILE_SERVICE_MAX_REQUEST_BODY_BYTES || '1048576')
let activeArchiveCount = 0

const mimeTypes = new Map([
  ['.txt', 'text/plain; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.ts', 'text/plain; charset=utf-8'],
  ['.tsx', 'text/plain; charset=utf-8'],
  ['.jsx', 'text/javascript; charset=utf-8'],
  ['.py', 'text/x-python; charset=utf-8'],
  ['.go', 'text/plain; charset=utf-8'],
  ['.rs', 'text/plain; charset=utf-8'],
  ['.yaml', 'text/yaml; charset=utf-8'],
  ['.yml', 'text/yaml; charset=utf-8'],
  ['.toml', 'text/plain; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.pdf', 'application/pdf'],
  ['.zip', 'application/zip'],
])

const textMimeTypes = new Set([
  'application/json; charset=utf-8',
  'text/javascript; charset=utf-8',
  'text/x-python; charset=utf-8',
  'text/yaml; charset=utf-8',
  'image/svg+xml',
])

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(payload))
}

function isPathInside(base, target) {
  const rel = relative(base, target)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function resolveInside(base, inputPath) {
  const candidate = resolve(isAbsolute(inputPath) ? inputPath : resolve(base, inputPath))
  if (!isPathInside(base, candidate)) {
    throw new Error('Path escapes workspace root')
  }
  return candidate
}

function decodeBasicAuthHeader(header) {
  if (!header?.startsWith('Basic ')) return null
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
    const separatorIndex = decoded.indexOf(':')
    if (separatorIndex === -1) return null
    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    }
  } catch {
    return null
  }
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(left || '', 'utf8')
  const rightBuffer = Buffer.from(right || '', 'utf8')
  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }
  return timingSafeEqual(leftBuffer, rightBuffer)
}

function isAuthorized(request) {
  if (!authPassword) return true
  const credentials = decodeBasicAuthHeader(request.headers.authorization)
  return (
    Boolean(credentials) &&
    safeCompare(credentials.username, authUser) &&
    safeCompare(credentials.password, authPassword)
  )
}

async function resolveWorkspaceRoot(url) {
  const directoryParam = url.searchParams.get('directory') || basePath
  const candidatePath = resolveInside(basePath, directoryParam)
  const candidateStats = await lstat(candidatePath)
  if (candidateStats.isSymbolicLink()) {
    throw new Error('Directory parameter cannot be a symbolic link')
  }

  const workspaceRoot = await realpath(candidatePath)
  if (!isPathInside(basePath, workspaceRoot)) {
    throw new Error('Directory escapes workspace root')
  }
  return workspaceRoot
}

async function resolveTargetPath(url) {
  const workspaceRoot = await resolveWorkspaceRoot(url)
  const pathParam = url.searchParams.get('path') || '.'
  const targetPath = resolveInside(workspaceRoot, pathParam)
  const targetStats = await lstat(targetPath)
  if (targetStats.isSymbolicLink()) {
    throw new Error('Symbolic links are not supported')
  }

  const resolvedTargetPath = await realpath(targetPath)
  if (!isPathInside(workspaceRoot, resolvedTargetPath)) {
    throw new Error('Resolved path escapes workspace root')
  }

  return resolvedTargetPath
}

async function resolveArchiveTarget(url) {
  const targetPath = await resolveTargetPath(url)
  const info = await stat(targetPath)
  if (!info.isDirectory()) {
    throw new Error('Target path is not a directory')
  }
  return targetPath
}

async function resolveFileTarget(url) {
  const targetPath = await resolveTargetPath(url)
  const info = await stat(targetPath)
  if (!info.isFile()) {
    throw new Error('Target path is not a file')
  }
  return targetPath
}

function buildContentDisposition(fileName) {
  const safeFileName = fileName.replace(/[\r\n"\\]/g, '').replace(/[^\x20-\x7E]/g, '') || 'download'
  return `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

function getMimeType(filePath) {
  return mimeTypes.get(extname(filePath).toLowerCase()) || 'application/octet-stream'
}

function shouldReadAsText(mimeType) {
  return mimeType.startsWith('text/') || textMimeTypes.has(mimeType)
}

async function readJsonBody(request) {
  const chunks = []
  let totalLength = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    totalLength += buffer.length
    if (totalLength > maxRequestBodyBytes) {
      throw new Error('Request body too large')
    }
    chunks.push(buffer)
  }

  if (chunks.length === 0) {
    return {}
  }

  const rawBody = Buffer.concat(chunks).toString('utf8')
  if (!rawBody.trim()) {
    return {}
  }

  return JSON.parse(rawBody)
}

function getClientError(statusCode, fallbackMessage) {
  return {
    statusCode,
    error: fallbackMessage,
  }
}

function streamArchive(targetPath, request, response) {
  if (activeArchiveCount >= maxConcurrentArchives) {
    writeJson(response, 429, { error: 'Too many concurrent archive requests' })
    return
  }

  activeArchiveCount += 1
  const outputName = `${basename(targetPath) || 'archive'}.zip`
  const zipProcess = spawn('zip', ['-yr', '-', basename(targetPath)], {
    cwd: dirname(targetPath),
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stderr = ''
  zipProcess.stderr.on('data', chunk => {
    if (stderr.length >= maxErrorOutput) {
      return
    }
    stderr += chunk.toString().slice(0, maxErrorOutput - stderr.length)
  })

  const archiveTimeout = setTimeout(() => {
    if (!zipProcess.killed) {
      zipProcess.kill('SIGKILL')
    }
  }, archiveTimeoutMs)

  response.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': buildContentDisposition(outputName),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })

  zipProcess.stdout.pipe(response)

  const stopProcess = () => {
    if (!zipProcess.killed) {
      zipProcess.kill('SIGTERM')
    }
  }

  request.on('close', stopProcess)
  response.on('close', stopProcess)

  zipProcess.on('close', code => {
    clearTimeout(archiveTimeout)
    activeArchiveCount = Math.max(0, activeArchiveCount - 1)
    request.off('close', stopProcess)
    response.off('close', stopProcess)

    if (code === 0) {
      if (!response.writableEnded) {
        response.end()
      }
      return
    }

    if (!response.headersSent) {
      console.error(`[file-service] archive failed (${code}): ${stderr.trim() || 'no stderr output'}`)
      writeJson(response, 500, { error: 'Failed to create archive' })
      return
    }

    response.destroy(new Error('Failed to create archive'))
  })
}

function streamFile(targetPath, request, response) {
  const outputName = basename(targetPath)
  const fileStream = createReadStream(targetPath)

  const stopStream = () => {
    fileStream.destroy()
  }

  request.on('close', stopStream)
  response.on('close', stopStream)

  stat(targetPath)
    .then(info => {
      response.writeHead(200, {
        'Content-Type': getMimeType(targetPath),
        'Content-Disposition': buildContentDisposition(outputName),
        'Content-Length': String(info.size),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })

      fileStream.pipe(response)
    })
    .catch(error => {
      request.off('close', stopStream)
      response.off('close', stopStream)
      fileStream.destroy()
      console.error('[file-service] file stat failed:', error)
      writeJson(response, 500, { error: 'Failed to download file' })
    })

  fileStream.on('error', error => {
    request.off('close', stopStream)
    response.off('close', stopStream)
    console.error('[file-service] file stream failed:', error)
    if (!response.headersSent) {
      writeJson(response, 500, { error: 'Failed to download file' })
      return
    }
    response.destroy(new Error('Failed to download file'))
  })

  fileStream.on('close', () => {
    request.off('close', stopStream)
    response.off('close', stopStream)
  })
}

async function saveTextFile(url, request, response) {
  const targetPath = await resolveFileTarget(url)
  const body = await readJsonBody(request)

  if (typeof body.content !== 'string') {
    throw new Error('Request content must be a string')
  }

  const currentContent = await readFile(targetPath, 'utf8')
  if (typeof body.expectedContent === 'string' && body.expectedContent !== currentContent) {
    writeJson(response, 409, { error: 'File content changed on disk' })
    return
  }

  await writeFile(targetPath, body.content, 'utf8')

  writeJson(response, 200, {
    path: url.searchParams.get('path') || basename(targetPath),
    savedAt: new Date().toISOString(),
  })
}

async function readFileContent(url, response) {
  const targetPath = await resolveFileTarget(url)
  const mimeType = getMimeType(targetPath)
  const buffer = await readFile(targetPath)

  if (shouldReadAsText(mimeType)) {
    writeJson(response, 200, {
      type: 'text',
      content: buffer.toString('utf8'),
      mimeType,
    })
    return
  }

  writeJson(response, 200, {
    type: 'text',
    content: buffer.toString('base64'),
    encoding: 'base64',
    mimeType,
  })
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    writeJson(response, 400, { error: 'Missing request url' })
    return
  }

  if (!isAuthorized(request)) {
    response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="OpenCodeUI file-service"' })
    response.end('Unauthorized')
    return
  }

  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)

  if (request.method === 'GET' && url.pathname === '/file/archive') {
    try {
      const targetPath = await resolveArchiveTarget(url)
      streamArchive(targetPath, request, response)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Archive generation failed'
      const clientError = getClientError(
        message === 'Target path is not a directory' ? 400 : 403,
        'Invalid archive request',
      )
      writeJson(response, clientError.statusCode, { error: clientError.error })
    }
    return
  }

  if (request.method === 'GET' && url.pathname === '/file/download') {
    try {
      const targetPath = await resolveFileTarget(url)
      streamFile(targetPath, request, response)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'File download failed'
      const clientError = getClientError(message === 'Target path is not a file' ? 400 : 403, 'Invalid file request')
      writeJson(response, clientError.statusCode, { error: clientError.error })
    }
    return
  }

  if (request.method === 'GET' && url.pathname === '/file/content') {
    try {
      await readFileContent(url, response)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'File read failed'
      const clientError = getClientError(message === 'Target path is not a file' ? 400 : 403, 'Invalid file request')
      writeJson(response, clientError.statusCode, { error: clientError.error })
    }
    return
  }

  if (request.method === 'PUT' && url.pathname === '/file/content') {
    try {
      await saveTextFile(url, request, response)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'File write failed'
      const statusCode =
        message === 'Target path is not a file' ||
        error instanceof SyntaxError ||
        message === 'Request content must be a string' ||
        message === 'Request body too large'
          ? 400
          : 403
      writeJson(response, statusCode, { error: statusCode === 400 ? 'Invalid write request' : 'Access denied' })
    }
    return
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    writeJson(response, 200, { ok: true })
    return
  }

  writeJson(response, 404, { error: 'Not found' })
})

server.listen(port, '0.0.0.0', () => {
  if (!authPassword) {
    console.warn('[file-service] running without password protection')
  }
  console.log(`[file-service] listening on ${port}, basePath=${basePath}`)
})
