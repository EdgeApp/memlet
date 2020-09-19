import { expect } from 'chai'
import { makeMemoryDisklet } from 'disklet'
import { describe, it } from 'mocha'

import { makeMemlet, Memlet } from '../src/index'
import { delay } from './utils'

export async function createObjects(memlet: Memlet) {
  const fileA = { content: 'file content' }
  const folderA = { content: 'folder content' }
  const fileB = { content: 'subfolder content' }

  memlet.setJson('File-A', fileA)
  memlet.setJson('Folder-A', folderA)
  memlet.setJson('Folder-A/File-B', fileB)

  return { fileA, folderA, fileB }
}

describe('memlet with evictions', async () => {
  it('can add files within maxMemoryUsage', async () => {
    const fileA = { content: 'some content' }
    const fileASize = JSON.stringify(fileA).length

    const disklet = makeMemoryDisklet()
    const memlet = makeMemlet(disklet, { maxMemoryUsage: fileASize })

    await memlet.setJson('File-A', fileA)

    const store = memlet._getStore()

    // Check files
    expect(Object.keys(store.files)).deep.equals(['File-A'])
    // Check memoryUsage
    expect(store.memoryUsage).to.equal(fileASize)
  })

  it('will remove old files when exceeding maxMemoryUsage', async () => {
    const fileA = { content: 'some content' }
    const fileB = { content: 'some other content' }
    const fileBSize = JSON.stringify(fileB).length

    const disklet = makeMemoryDisklet()
    const memlet = makeMemlet(disklet, {
      maxMemoryUsage: fileBSize
    })

    await memlet.setJson('File-A', fileA)
    await delay(10)
    await memlet.setJson('File-B', fileB)

    const store = memlet._getStore()

    // Check files
    expect(Object.keys(store.files)).deep.equals(['File-B'])
    // Check memoryUsage
    expect(store.memoryUsage).to.equal(fileBSize)
  })
})
