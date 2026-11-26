/** Trimmed session snapshot for the live progress stream shown in chat panels. */
export const compactProgress = (messages: any[]) =>
    (Array.isArray(messages) ? messages : []).map((message: any) => ({
        id: message?.id,
        type: message?.type,
        content: Array.isArray(message?.content)
            ? message.content
                  .filter((part: any) => ['reasoning', 'text', 'tool'].includes(part?.type))
                  .map((part: any) => {
                      if (part.type !== 'tool') {
                          return {type: part.type, text: String(part?.text || '').slice(0, 1500)}
                      }
                      const time = part?.time || {}
                      const start = Number(time.ran ?? time.created ?? 0)
                      const end = Number(time.completed ?? 0)
                      return {
                          type: 'tool',
                          id: part.id,
                          name: part.name || part.tool,
                          durationMs: end > start ? end - start : undefined,
                          state: {
                              status: part.state?.status || '',
                              input: part.state?.input || {},
                              content: (part.state?.content || [])
                                  .map((item: any) => ({
                                      type: 'text',
                                      text: String(item?.text || '').slice(0, 800),
                                  }))
                                  .slice(0, 2),
                          },
                      }
                  })
            : [],
    }))

/**
 * Poll the session and emit its current-turn messages.
 * `existingIds` is the conversation that existed before this run; those messages
 * are skipped so a resumed session does not replay its whole history as new parts.
 * Messages emitted during this run are always re-sent so streaming updates land.
 */
export const startProgressStream = (
    host: any,
    sessionID: string,
    onProgress: (messages: any[]) => void,
    existingIds: Set<string> = new Set(),
    intervalMs = 700,
) => {
    const emitted = new Set<string>()
    let last = ''
    const timer = setInterval(() => {
        void host.session
            .context({sessionID})
            .then((messages: any[]) => {
                const current = (Array.isArray(messages) ? messages : []).filter(
                    (message: any) => message?.id && (!existingIds.has(message.id) || emitted.has(message.id)),
                )
                if (current.length === 0) return
                for (const message of current) emitted.add(message.id)
                const compact = compactProgress(current)
                const text = JSON.stringify(compact)
                if (text !== last) {
                    last = text
                    onProgress(compact)
                }
            })
            .catch(() => {})
    }, intervalMs)
    timer.unref?.()
    return () => clearInterval(timer)
}
