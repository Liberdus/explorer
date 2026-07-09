const PATCHED_CONSOLE_LOG_FLAG = '__liberdusExplorerTimestampedLog'

type PatchedConsole = Console & {
  [PATCHED_CONSOLE_LOG_FLAG]?: boolean
}

const patchedConsole = console as PatchedConsole

// Guard against wrapping console methods multiple times in the same process.
if (!patchedConsole[PATCHED_CONSOLE_LOG_FLAG]) {
  const methodsToPatch: Array<'log' | 'info' | 'warn' | 'error' | 'debug'> = [
    'log',
    'info',
    'warn',
    'error',
    'debug',
  ]

  // Prefix selected console output with an ISO timestamp while preserving arguments.
  for (const method of methodsToPatch) {
    const originalMethod = console[method].bind(console)
    console[method] = (...args: unknown[]): void => {
      const timestamp = new Date().toISOString()
      originalMethod(`[${timestamp}]`, ...args)
    }
  }

  // Mark console as already patched so later imports do not wrap again.
  patchedConsole[PATCHED_CONSOLE_LOG_FLAG] = true
}

export {}
