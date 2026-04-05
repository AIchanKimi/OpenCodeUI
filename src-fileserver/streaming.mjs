export function attachAbortHandlers(request, response, onAbort) {
  let aborted = false

  const handleAbort = () => {
    if (aborted) {
      return
    }
    aborted = true
    onAbort()
  }

  const handleResponseClose = () => {
    if (!response.writableEnded) {
      handleAbort()
    }
  }

  request.on('aborted', handleAbort)
  response.on('close', handleResponseClose)

  return () => {
    request.off('aborted', handleAbort)
    response.off('close', handleResponseClose)
  }
}
