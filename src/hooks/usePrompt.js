import { useEffect, useState } from 'react'

function usePrompt(sessionId) {
  const [promptState, setPromptState] = useState(null)

  useEffect(() => {
    let isActive = true

    if (!window.terminalApi || !sessionId) {
      setPromptState(null)
      return undefined
    }

    window.terminalApi
      .getPromptState({ id: sessionId })
      .then((state) => {
        if (isActive) {
          setPromptState(state)
        }
      })
      .catch(() => {
        if (isActive) {
          setPromptState(null)
        }
      })

    const removePromptListener = window.terminalApi.onPromptState((payload) => {
      if (payload.id === sessionId) {
        setPromptState(payload.prompt)
      }
    })

    return () => {
      isActive = false
      removePromptListener?.()
    }
  }, [sessionId])

  return promptState
}

export default usePrompt
