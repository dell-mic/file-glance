declare global {
  interface Window {
    _paq: Array
    launchQueue?: LaunchQueue
  }

  interface LaunchQueue {
    setConsumer: (callback: (launchParams: LaunchParams) => void) => void
  }

  interface LaunchParams {
    files?: FileSystemFileHandle[]
  }
}

// window._paq = window._paq || []
export {}
