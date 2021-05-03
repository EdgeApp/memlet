import { Disklet, DiskletListing } from 'disklet'

import { makeFileQueue } from './fileQueue'
import { folderizePath, normalizePath } from './helpers/paths'
import { File, Memlet, MemletConfig, MemletState } from './types'

export * from './types'

const defaultConfig: MemletConfig = {
  maxMemoryUsage: Infinity
}

const state: MemletState = {
  config: { ...defaultConfig },
  store: {
    memoryUsage: 0,
    files: {}
  },
  fileQueue: makeFileQueue()
}

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
  // Private properties

  /**
   * A unique ID for the memlet instance. The ID is used as a prefix for each
   * file's key in the shared file cache.
   */
  const memletInstanceId = countOfMemletInstances++

  const memlet: Memlet = {
    // Removes an object at a given path
    delete: async (path: string) => {
      /**
       * No soft-delete: delete from memlet first then delete from disklet
       * (because disklet delete might succeed in delete, but fail on
       * something else).
       */
      const file = deleteStoreFile(path)

      if (file != null) {
        state.fileQueue.remove(file)
      }

      await disklet.delete(path)
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
        // Update file's position in the file queue and lastTouchedTimestamp
        state.fileQueue.requeue(file)

        // Invoke adjustMemoryUsage to potentially evict files
        adjustMemoryUsage(0)

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

          addStoreFile(path, data, dataString.length)

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
            addStoreFile(path, null, 0, err)
          }

          // Re-throw the error from disklet
          throw err
        }
      }
    },

    // Set an object at a given path
    setJson: async (path: string, data: any) => {
      /**
       * Write-through policy: write to disklet first then put it in the cache.
       */
      const dataString = JSON.stringify(data)

      await disklet.setText(path, dataString)

      const key = getCacheKey(path)
      const file = getStoreFile(key)

      if (file != null) {
        const previousSize = file.size

        // Update all of file's fields
        file.data = data
        file.size = JSON.stringify(data).length

        // Remove error object if present
        delete file.notFoundError

        // Update file's position in the file queue
        state.fileQueue.requeue(file)

        // Calculate the difference in memory usage if there is an existing file
        const sizeDiff = file.size - previousSize

        // Update memory usage with size difference
        adjustMemoryUsage(sizeDiff)
      } else {
        addStoreFile(path, data, dataString.length)
      }
    }
  }

  return memlet

  // Private methods

  function addStoreFile(
    path: string,
    data: any,
    size: number,
    notFoundError?: any
  ): void {
    const key = getCacheKey(path)

    const file: File = {
      key,
      data,
      size,
      lastTouchedTimestamp: Date.now(),
      notFoundError
    }

    // Add file to file queue
    state.fileQueue.enqueue(file)

    // Add file's size to memory usage
    adjustMemoryUsage(file.size)

    // Add file to the store files map
    state.store.files[key] = file
  }

  // Used to add undefined type checking to file retrieval
  function getStoreFile(key: string): File | undefined {
    return state.store.files[key]
  }

  function deleteStoreFile(key: string): File | undefined {
    const file = getStoreFile(key)

    if (file != null) {
      adjustMemoryUsage(-file.size)
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete state.store.files[key]
    }

    return file
  }

  function adjustMemoryUsage(bytes?: number): void {
    if (bytes != null) {
      state.store.memoryUsage += bytes
    }

    // Remove files if memory usage exceeds maxMemoryUsage
    if (state.store.memoryUsage > state.config.maxMemoryUsage) {
      const fileEntry = state.fileQueue.dequeue()
      if (fileEntry != null) {
        // Deleting file from store will invoke adjustMemoryUsage again
        deleteStoreFile(fileEntry.key)
      }
    }
  }

  function getCacheKey(path: string): string {
    return `${memletInstanceId}:${path}`
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
  state.fileQueue = makeFileQueue()
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
