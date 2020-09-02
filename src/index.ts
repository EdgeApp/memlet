import { Disklet } from 'disklet'
import { Memlet, MemletStore, File, MemletListing } from './types'

export * from './types'

export function makeMemlet(disklet: Disklet): Memlet {
  // Private properties

  const store: MemletStore = {
    files: {}
  }

  // Private methods

  const updateFile = (key: string, data: any) => {
    const file: File = {
      filename: key,
      data
    }

    store.files[key] = file
  }

  return {
    // Removes an object at a given path
    delete: async (path: string) => {
      /**
       * No soft-delete: delete from memlet first then delete from disklet
       * (because disklet delete might succeed in delete, but fail on
       * something else).
       */
      delete store.files[path]
      await disklet.delete(path)
    },

    // Lists objects from a given path
    list: async (path?: string) => {
      // Direct pass-through to disklet
      return await disklet.list(path)
    },

    // Get an object at given path
    getJSON: async (filename: string) => {
      const file = store.files[filename]

      if (file) {
        // Return file found in memory store
        return file.data
      } else {
        // Retrieve file from disklet, cache it, then return
        const data = await disklet
          .getText(filename)
          .then(dataString => JSON.parse(dataString))

        updateFile(filename, data)

        return data
      }
    },

    // Set an object at a given path
    setJSON: async (filename: string, data: any) => {
      /**
       * Write-through policy: write to disklet first then put it in the cache.
       */
      const dataString = JSON.stringify(data)

      await disklet.setText(filename, dataString)

      updateFile(filename, data)
    }
  }
}
