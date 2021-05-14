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
  actionQueue: Queue<Action>
}

export interface MemletStore {
  memoryUsage: number
  files: FileMap
  actions: { [key: string]: Action }
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

export interface Action {
  key: string
  file: File
  actionType: ActionType
}
export type ActionType = 'write' | 'delete'
