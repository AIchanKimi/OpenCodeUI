import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { attachAbortHandlers } from './streaming.mjs'

function createResponse() {
  const response = new EventEmitter()
  response.writableEnded = false
  return response
}

describe('attachAbortHandlers', () => {
  it('does not stop processing when request close fires after a normal GET lifecycle', () => {
    const request = new EventEmitter()
    const response = createResponse()
    const onAbort = vi.fn()

    attachAbortHandlers(request, response, onAbort)

    request.emit('close')

    expect(onAbort).not.toHaveBeenCalled()
  })

  it('stops processing when request is aborted', () => {
    const request = new EventEmitter()
    const response = createResponse()
    const onAbort = vi.fn()

    attachAbortHandlers(request, response, onAbort)

    request.emit('aborted')

    expect(onAbort).toHaveBeenCalledTimes(1)
  })

  it('stops processing when response closes before finishing', () => {
    const request = new EventEmitter()
    const response = createResponse()
    const onAbort = vi.fn()

    attachAbortHandlers(request, response, onAbort)

    response.emit('close')

    expect(onAbort).toHaveBeenCalledTimes(1)
  })

  it('does not stop processing when response closes after finish', () => {
    const request = new EventEmitter()
    const response = createResponse()
    const onAbort = vi.fn()

    attachAbortHandlers(request, response, onAbort)

    response.writableEnded = true
    response.emit('close')

    expect(onAbort).not.toHaveBeenCalled()
  })
})
