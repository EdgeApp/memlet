export interface Memlet {
  list: (path?: string) => Promise<MemletListing>

  delete: (path: string) => Promise<void>

  getJSON: (path: string) => Promise<any>
  setJSON: (path: string, obj: any) => Promise<void>

  getStore: () => MemletStore
}

export interface MemletStore {
  memoryUsage: number
  // maxMemoryUseage: number
  files: FileMap
  // filesOrderedByDate: FileIndex
}

export interface FileMap {
  [filename: string]: File
}

export interface File {
  filename: string
  size: number
  data: any
  lastTouchedTimestamp: number
}

// export type FileIndex = FileIndexEntry[]

// export interface FileIndexEntry {
//   filename: string
//   timestamp: number
// }

export interface MemletListing {
  [path: string]: 'file' | 'folder'
}
