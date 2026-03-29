import usePrompt from '../hooks/usePrompt'

function buildPromptString(promptState) {
  if (!promptState) {
    return 'Loading live shell context...'
  }

  const segments = [promptState.userHost, promptState.displayCwd]

  if (promptState.git?.available && promptState.git?.inRepo && promptState.git?.branch) {
    const gitSymbol = promptState.git.isDirty ? '*' : '\u2714'
    segments.push(`${promptState.git.branch} ${gitSymbol}`)
  }

  return `${segments.join(' | ')} >`
}

function buildStatusCopy(promptState) {
  if (!promptState) {
    return 'The prompt preview will attach as soon as the active terminal session is ready.'
  }

  if (promptState.git?.status === 'unknown') {
    return 'Gathering working directory and git metadata from the active shell session.'
  }

  if (promptState.terminated) {
    return 'The shell process has exited. The preview is showing the last known directory and git state for this tab.'
  }

  if (!promptState.git?.available) {
    return 'Git was not found on this machine, so the preview is showing user, host, and working directory only.'
  }

  if (promptState.git?.status === 'error') {
    return 'Git metadata could not be refreshed for the active directory, so the preview is temporarily showing only user, host, and directory.'
  }

  if (!promptState.git?.inRepo) {
    return 'This directory is not a git repository, so the preview is showing user, host, and working directory only.'
  }

  return promptState.git.isDirty
    ? 'Git changes are detected in the active directory and the preview will refresh again after the next command.'
    : 'Git state is clean and the preview will keep tracking directory and branch changes after each command.'
}

function Prompt({ activeTab, sessionId }) {
  const promptState = usePrompt(sessionId)

  return (
    <section className="info-card">
      <div className="section-heading">
        <h2>Prompt Preview</h2>
        <span className="pill">{activeTab?.title ?? 'No Session'}</span>
      </div>
      <code className="prompt-preview">{buildPromptString(promptState)}</code>
      <div className="prompt-facts">
        <span className="prompt-fact">{promptState?.userHost ?? 'Detecting user@host'}</span>
        <span className="prompt-fact">{promptState?.displayCwd ?? 'Detecting directory'}</span>
        <span className="prompt-fact">
          {promptState?.git?.status === 'unknown'
            ? 'detecting git'
            : promptState?.git?.status === 'error'
              ? 'git error'
            : promptState?.git?.inRepo
            ? `${promptState.git.branch ?? 'detached'} ${promptState.git.isDirty ? 'modified' : 'clean'}`
            : promptState?.git?.available === false
              ? 'git unavailable'
              : 'not a repo'}
        </span>
      </div>
      <p className="muted-copy">{buildStatusCopy(promptState)}</p>
    </section>
  )
}

export default Prompt
