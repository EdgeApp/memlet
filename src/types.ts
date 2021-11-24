import { DiskletListing } from 'disklet'

import { Queue } from './queue'

export interface Memlet {
  list: (path?: string) => Promise<DiskletListing>

  delete: (path: string) => Promise<void>

  getJson: (path: string) => Promise<any>
  setJson: (path: string, obj: any) => Promise<void>

  onFlush: Generator<Promise<void> | undefined>
}

export interface MemletState {
  config: MemletConfig
  store: MemletStore
  fileQueue: Queue<File>
  actionQueue: Queue<Action>
  nextFlushEvent: Promise<void> | undefined
}

export interface MemletStore {
  memoryUsage: number
  errors: ErrorMap
  files: FileMap
  actions: { [key: string]: Action }
}

export interface MemletConfig {
  maxMemoryUsage: number
}

export interface ErrorMap {
  [key: string]: any
}

export interface FileMap {
  [key: string]: File
}

export interface File {
  key: string
  size: number
  data: any
}

export interface Action {
  key: string
  type: 'write' | 'delete'
  routine: () => Promise<void>
}
