import { DiskletListing } from 'disklet'

import { Queue } from './queue'

export interface Memlet {
  list: (path?: string) => Promise<DiskletListing>

  delete: (path: string) => Promise<void>

  getJson: (path: string) => Promise<any>
  setJson: (path: string, obj: any) => Promise<void>
}

export interface MemletState {
  config: MemletConfig
  store: MemletStore
  fileQueue: Queue<File>
}

export interface MemletStore {
  memoryUsage: number
  files: FileMap
}

export interface MemletConfig {
  maxMemoryUsage: number
}

export interface FileMap {
  [key: string]: File
}

export interface File {
  key: string
  size: number
  data: any
  notFoundError?: any
}
