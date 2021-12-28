import { DiskletListing } from 'disklet'

import { Memlet } from '../types'
import { folderizePath, normalizePath } from './paths'

export function navigateMemlet(memlet: Memlet, path: string): Memlet {
  const prefix = folderizePath(normalizePath(path))
  return {
    delete: function _delete(path) {
      return memlet.delete(prefix + path)
    },
    getJson: function getJson(path) {
      return memlet.getJson(prefix + path)
    },
    list: function list(path = '') {
      return memlet.list(prefix + path).then(listing => {
        const out: DiskletListing = {}
        for (const path in listing) {
          out[path.replace(prefix, '')] = listing[path]
        }
        return out
      })
    },
    setJson: function setJson(path, data) {
      return memlet.setJson(prefix + path, data)
    },
    onFlush: memlet.onFlush,
    _instanceId: memlet._instanceId
  }
}
