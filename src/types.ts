import { DiskletListing } from 'disklet'

import { FileQueue } from './file-queue'

export interface Memlet {
  list: (path?: string) => Promise<DiskletListing>

  delete: (path: string) => Promise<void>

  getJson: (path: string) => Promise<any>
  setJson: (path: string, obj: any) => Promise<void>
}

export interface MemletState {
  config: MemletConfig
  store: MemletStore
  fileQueue: FileQueue
}

export interface MemletStore {
  memoryUsage: number
  files: FileMap
}

export interface MemletConfig {
  maxMemoryUsage: number
}

export interface FileMap {
  [filename: string]: File
}

export interface File {
  filename: string
  size: number
  data: any
  lastTouchedTimestamp: number
  notFoundError?: any
}
