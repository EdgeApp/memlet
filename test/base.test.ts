import { expect } from 'chai'
import { makeMemoryDisklet } from 'disklet'
import { describe, it } from 'mocha'

import { makeMemlet, Memlet } from '../src/index'

export async function createObjects(memlet: Memlet) {
  const fileA = { content: 'file content' }
  const folderA = { content: 'folder content' }
  const fileB = { content: 'subfolder content' }

  memlet.setJson('File-A', fileA)
  memlet.setJson('Folder-A', folderA)
  memlet.setJson('Folder-A/File-B', fileB)

  return { fileA, folderA, fileB }
}

describe('memlet', async () => {
  const disklet = makeMemoryDisklet()
  const memlet = makeMemlet(disklet)

  const { fileA, folderA, fileB } = await createObjects(memlet)

  it('can list root files', async () => {
    const expected = {
      'File-A': 'file',
      'Folder-A': 'folder'
    }

    expect(await memlet.list()).deep.equals(expected)
  })

  it('can list file', async () => {
    const expected = {
      'File-A': 'file'
    }

    expect(await memlet.list('File-A')).deep.equals(expected)
  })

  it('can list folders', async () => {
    const expected = {
      'Folder-A': 'file',
      'Folder-A/File-B': 'file'
    }

    expect(await memlet.list('Folder-A')).deep.equals(expected)
  })

  it('can list file in folder', async () => {
    const expected = {
      'Folder-A/File-B': 'file'
    }

    expect(await memlet.list('Folder-A/File-B')).deep.equals(expected)
  })

  it('can retrieve file', async () => {
    expect(await memlet.getJson('File-A')).deep.equals(fileA)
  })

  it('can retrieve folder', async () => {
    expect(await memlet.getJson('Folder-A')).deep.equals(folderA)
  })

  it('can retrieve file in folder', async () => {
    expect(await memlet.getJson('Folder-A/File-B')).deep.equals(fileB)
  })

  it('memory usage is correct', async () => {
    const store = memlet._getStore()

    const sumOfFileSizes = Object.values(store.files).reduce(
      (sum, file) => sum + file.size,
      0
    )

    expect(store.memoryUsage).to.equal(sumOfFileSizes)
  })
})
