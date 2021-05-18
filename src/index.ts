import { Disklet, DiskletListing } from 'disklet'

import { delay } from './helpers/delay'
import { fileKeyToPath, folderizePath, normalizePath } from './helpers/paths'
import { makeQueue } from './Queue'
import {
  Action,
  ActionType,
  File,
  Memlet,
  MemletConfig,
  MemletState
} from './types'

export * from './types'

const defaultConfig: MemletConfig = {
  maxMemoryUsage: Infinity
}

const state: MemletState = {
  config: { ...defaultConfig },
  store: {
    memoryUsage: 0,
    files: {},
    actions: {}
  },
  fileQueue: makeQueue(),
  actionQueue: makeQueue()
}

/**
 * This is the number of files to persist to disk at every interval of saving
 * in-memory file data to disk.
 */
const MAX_BATCH_SIZE = 100
const DRAIN_INTERVAL = 100

/**
 * This is to keep a running count of memlet instances in order to determine
 * a unique ID for each instance.
 */
let countOfMemletInstances = 0

/**
 * Regex to match error message for files not found errors.
 * First, variation is from memory and localStorage memlet backends.
 * Second variation is from iOS memlet backend.
 */
const notFoundErrorMessageRegex = /^Cannot load ".+"$|^Cannot read '.+'$/

export function makeMemlet(disklet: Disklet): Memlet {
  /**
   * A unique ID for the memlet instance. The ID is used as a prefix for each
   * file's key in the shared file cache.
   */
  const memletInstanceId = countOfMemletInstances++

  let _nextFlushEvent: Promise<void> | undefined

  // ---------------------------------------------------------------------
  // Memlet Public Interface
  // ---------------------------------------------------------------------

  const memlet: Memlet = {
    // Removes an object at a given path
    delete: async (path: string) => {
      /**
       * No soft-delete: delete from memlet first then delete from disklet
       * (because disklet delete might succeed in delete, but fail on
       * something else).
       */
      const file = await deleteStoreFile(path)

      if (file != null) {
        state.fileQueue.remove(file)
        state.actionQueue.requeue(makeAction(file, 'delete'))
      }
    },

    // Lists objects from a given path
    list: async (path: string = '') => {
      const filepath = normalizePath(path)
      const key = getCacheKey(filepath)
      const out: DiskletListing = {}

      // Try the path as a file:
      if (state.store.files[key] != null) out[filepath] = 'file'

      // Try the path as a folder:
      const folderKey = getCacheKey(folderizePath(filepath))
      for (const key of Object.keys(state.store.files)) {
        if (key.indexOf(folderKey) !== 0) continue

        const pathOfKey = key.split(':')[1]
        const slashIndex = pathOfKey.indexOf('/', folderKey.length)
        if (slashIndex < 0) out[pathOfKey] = 'file'
        else out[pathOfKey.slice(0, slashIndex)] = 'folder'
      }

      return out
    },

    // Get an object at given path
    getJson: async (path: string) => {
      const key = getCacheKey(path)
      const file = getStoreFile(key)

      if (file != null) {
        // Update position in the file queue
        state.fileQueue.requeue(file)

        // Invoke adjustMemoryUsage to potentially evict files
        await adjustMemoryUsage(0)

        // If file contains a caught error, throw it.
        if (file.notFoundError != null) {
          throw file.notFoundError
        }

        // Return file found in memory store
        return file.data
      } else {
        try {
          // Retrieve file from disklet, store it, then return
          const dataString = await disklet.getText(path)
          const data = JSON.parse(dataString)

          await addStoreFile(path, data, dataString.length)

          return data
        } catch (err) {
          /**
           * For file not found errors, store null data, include the error
           * object, and then then re-throw. This saves needless disklet
           * accesses on subsequent getJson invocations.
           */
          if (
            notFoundErrorMessageRegex.test(err?.message) ||
            err?.code === 'ENOENT'
          ) {
            await addStoreFile(path, null, 0, err)
          }

          // Re-throw the error from disklet
          throw err
        }
      }
    },

    // Set an object at a given path
    setJson: async (path: string, data: any) => {
      /**
       * Write-through policy: write to memory cache first, then let the data be
       * drained to disklet later.
       */
      const key = getCacheKey(path)
      const file = getStoreFile(key)
      const dataString = JSON.stringify(data)

      if (file != null) {
        const previousSize = file.size

        // Update all of file's fields
        file.data = data
        file.size = dataString.length

        // Remove error object if present
        delete file.notFoundError

        // Remove file from file queue because it has been updated
        state.fileQueue.remove(file)

        // Update position in the action queue
        state.actionQueue.requeue(makeAction(file, 'write'))

        // Calculate the difference in memory usage if there is an existing file
        const sizeDiff = file.size - previousSize

        // Update memory usage with size difference
        await adjustMemoryUsage(sizeDiff)
      } else {
        await addStoreFile(path, data, dataString.length)
      }

      // Schedule to flush action queue
      _nextFlushEvent = startFlushing()
    },

    onFlush: (function* flushEventGenerator() {
      while (true) {
        yield _nextFlushEvent
      }
    })()
  }
  return memlet

  // ---------------------------------------------------------------------
  // Private Functions
  // ---------------------------------------------------------------------

  async function addStoreFile(
    path: string,
    data: any,
    size: number,
    notFoundError?: any
  ): Promise<void> {
    const key = getCacheKey(path)

    const file: File = {
      key,
      data,
      size,
      notFoundError
    }

    // Add file to file queue
    state.actionQueue.requeue(makeAction(file, 'write'))

    // Add file to the store files map
    state.store.files[key] = file

    // Add file's size to memory usage
    await adjustMemoryUsage(file.size)
  }

  // Used to add undefined type checking to file retrieval
  function getStoreFile(key: string): File | undefined {
    return state.store.files[key]
  }

  async function deleteStoreFile(key: string): Promise<File | undefined> {
    const file = getStoreFile(key)

    if (file != null) {
      // Deleting file from store should invoke adjustMemoryUsage again
      await adjustMemoryUsage(-file.size)
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete state.store.files[key]
    }

    return file
  }

  async function adjustMemoryUsage(bytes?: number): Promise<void> {
    if (bytes != null) {
      state.store.memoryUsage += bytes
    }

    // Remove files if memory usage exceeds maxMemoryUsage
    if (state.store.memoryUsage > state.config.maxMemoryUsage) {
      // Remove file from persistence queue
      const file = state.fileQueue.dequeue()
      if (file != null) {
        await deleteStoreFile(file.key)
      }
    }
  }

  function getCacheKey(path: string): string {
    return `${memletInstanceId}:${path}`
  }

  /**
   * Complete action will commit the aciton to the peristence layer (disklet).
   */
  async function completeAction(action: Action): Promise<void> {
    const { file, actionType } = action
    const path = fileKeyToPath(file.key)
    const dataString = JSON.stringify(file.data)

    switch (actionType) {
      case 'write':
        await disklet.setText(path, dataString)
        break
      case 'delete':
        await disklet.delete(path)
        break
    }
  }

  async function flushActions(): Promise<void> {
    for (let i = 0; i < MAX_BATCH_SIZE; ++i) {
      // Pull out any memory-only files
      const action = state.actionQueue.dequeue()

      // Exit loop if no memory-only files
      if (action == null) break

      // Persist file
      await completeAction(action)

      // Move file to written file queue
      state.fileQueue.requeue(action.file)
    }
    // Add file's size to memory usage
    await adjustMemoryUsage(0)
  }

  /**
   * Scheduler to drain file's from memory onto disk.
   * This is run continually at a constant interval once invoked until
   * there are no more memory-only files.
   */
  function startFlushing(): Promise<void> {
    // If timeout is already running then do nothing
    if (_nextFlushEvent != null) {
      return _nextFlushEvent
    }

    return new Promise((resolve, reject) => {
      delay(DRAIN_INTERVAL)
        .then(flushActions)
        .then(() => {
          if (state.actionQueue.list().length > 0) {
            return startFlushing()
          }

          resolve()
          _nextFlushEvent = undefined
        })
        .catch(err => {
          // Uh oh spaghettios
          reject(err)
          _nextFlushEvent = undefined
        })
    })
  }
}

// Update's module's config
export function setMemletConfig(config: Partial<MemletConfig>): void {
  // Divide given maxMemoryUsage config parameter to respresent char-length
  if (config.maxMemoryUsage != null) {
    config.maxMemoryUsage = config.maxMemoryUsage / 2
  }

  // Update state's config
  state.config = { ...state.config, ...config }
}

// Clears the file cache fields in the module's state
export function clearMemletCache(): void {
  state.store.memoryUsage = 0
  state.store.files = {}
  state.fileQueue = makeQueue()
  state.actionQueue = makeQueue()
}

// Resets config and clears file cache
export function resetMemletState(): void {
  state.config = { ...defaultConfig }
  clearMemletCache()
}

// Internal Methods:

// Get the module's state object
export function _getMemletState(): Readonly<MemletState> {
  return state
}

/**
 * Makes an Action for using the file's existing action if available.
 * We want to use an existing action to keep the same queue position.
 */
function makeAction(file: File, actionType: ActionType): Action {
  const existingAction = state.store.actions[file.key]

  // If action already exists for file, update it and return it.
  if (existingAction != null) {
    existingAction.actionType = actionType
    return existingAction
  }

  // Create new action for file, store it, and return it
  const action = {
    key: file.key,
    actionType,
    file
  }
  state.store.actions[file.key] = action
  return action
}
