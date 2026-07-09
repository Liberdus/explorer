const PATCHED_CONSOLE_LOG_FLAG = '__liberdusExplorerTimestampedLog'

type PatchedConsole = Console & {
  [PATCHED_CONSOLE_LOG_FLAG]?: boolean
}

const patchedConsole = console as PatchedConsole

// Guard against wrapping console.log multiple times in the same process.
if (!patchedConsole[PATCHED_CONSOLE_LOG_FLAG]) {
  const originalLog = console.log.bind(console)

  // Prefix every log line with an ISO timestamp while preserving original arguments.
  console.log = (...args: unknown[]): void => {
    const timestamp = new Date().toISOString()
    originalLog(`[${timestamp}]`, ...args)
  }

  // Mark console as already patched so later imports do not wrap again.
  patchedConsole[PATCHED_CONSOLE_LOG_FLAG] = true
}

export {}
