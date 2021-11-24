import { assert, expect } from 'chai'
import { makeMemoryDisklet, makeNodeDisklet } from 'disklet'
import { describe, it } from 'mocha'

import { delay } from '../src/helpers/delay'
import { _getMemletState, makeMemlet, Memlet } from '../src/index'
import { QueueItem } from '../src/queue'

interface DataObjMap {
  [fileName: string]: DataObj
}
interface DataObj {
  content: string
}

export async function createObjects(memlet: Memlet): Promise<DataObjMap> {
  const fileA = { content: 'file content' }
  const folderA = { content: 'folder content' }
  const fileB = { content: 'subfolder content' }

  await memlet.setJson('File-A', fileA)
  await memlet.setJson('Folder-A', folderA)
  await memlet.setJson('Folder-A/File-B', fileB)

  return { fileA, folderA, fileB }
}

describe('Memlet', () => {
  const disklet = makeMemoryDisklet()
  const memlet = makeMemlet(disklet)

  let data: DataObjMap

  before(async () => {
    data = await createObjects(memlet)
  })

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
    expect(await memlet.getJson('File-A')).deep.equals(data.fileA)
  })

  it('can retrieve folder', async () => {
    expect(await memlet.getJson('Folder-A')).deep.equals(data.folderA)
  })

  it('can retrieve file in folder', async () => {
    expect(await memlet.getJson('Folder-A/File-B')).deep.equals(data.fileB)
  })

  it('will not leak memory in queues', async () => {
    const { fileQueue, actionQueue } = _getMemletState()

    const hasNoDuplicates = (files: QueueItem[]): void => {
      const keys = files.map(({ key }) => key)
      const dedupedKeys = keys.filter(
        (key, index, keys) => index === keys.indexOf(key)
      )

      expect(keys).to.deep.equal(
        dedupedKeys,
        'expected no duplicate keys in queues'
      )
    }

    await memlet.setJson('leaky-file', 'no leak please')
    await delay(1)
    await memlet.setJson('other0-file', 'no leak please')
    await delay(1)
    await memlet.setJson('other1-file', 'no leak please')
    await delay(1)
    await memlet.setJson('other2-file', 'no leak please')
    await delay(1)
    await memlet.setJson('other3-file', 'no leak please')
    await delay(1)
    await memlet.setJson('other4-file', 'no leak please')
    await delay(1)
    await memlet.setJson('other5-file', 'no leak please')
    await delay(1)

    await delay(200)

    hasNoDuplicates([...fileQueue.list(), ...actionQueue.list()])

    await memlet.setJson('leaky-file', 'no leak please')

    hasNoDuplicates([...fileQueue.list(), ...actionQueue.list()])

    await memlet.setJson('leaky-file', 'no leak please')

    hasNoDuplicates([...fileQueue.list(), ...actionQueue.list()])
    await delay(101)

    hasNoDuplicates([...fileQueue.list(), ...actionQueue.list()])
  })

  it('memory usage is correct', async () => {
    const state = _getMemletState()

    const sumOfFileSizes = Object.values(state.store.files).reduce(
      (sum, file) => sum + file.size,
      0
    )

    expect(state.store.memoryUsage).to.equal(sumOfFileSizes)
  })

  it('will cache on file not found error (memory backend)', async () => {
    const disklet = makeMemoryDisklet()
    const memlet = makeMemlet(disklet)

    let caughtError: any

    // First read: Catch and save error
    try {
      await memlet.getJson('unknown')
    } catch (err) {
      caughtError = err
    }

    // Second read: Catch and compare error
    try {
      await memlet.getJson('unknown')
    } catch (err) {
      assert(
        err === caughtError,
        'Second error thrown is not an exact match to the first error'
      )
    }
  })

  it('will cache on file not found error (node backend)', async () => {
    const disklet = makeNodeDisklet('./tmp')
    const memlet = makeMemlet(disklet)

    let caughtError: any

    // First read: Catch and save error
    try {
      await memlet.getJson('unknown')
    } catch (err) {
      caughtError = err
    }

    // Second read: Catch and compare error
    try {
      await memlet.getJson('unknown')
    } catch (err) {
      if (err !== caughtError) {
        assert.fail(
          'Second error thrown is not an exact match to the first error'
        )
      }
    }
  })

  it('will cache on file not found error but not throw after setJson', async () => {
    const disklet = makeMemoryDisklet()
    const memlet = makeMemlet(disklet)

    const writeData = 'some data'
    let caughtError: any

    // First read should throw error
    try {
      await memlet.getJson('unknown')
    } catch (err) {
      caughtError = err
    }

    // Assert that error was caught
    assert.isDefined(caughtError)

    // Write data
    await memlet.setJson('unknown', writeData)

    // Second read should not throw error
    const readData = await memlet.getJson('unknown')

    // Read data should match write data
    expect(readData).to.equal(writeData)
  })

  it('will properly delete', async () => {
    const disklet = makeMemoryDisklet()
    const memlet = makeMemlet(disklet)

    const filename = 'file-to-delete'

    // Write file
    await memlet.setJson(filename, 'some data')

    // Assertions after write
    expect(await memlet.list(), 'memlet after write').to.deep.equal({
      [filename]: 'file'
    })
    expect(await disklet.list(), 'disklet after write').to.deep.equal({})

    // Wait for write action to be flushed
    await memlet.onFlush.next().value

    // Assertions after write action flush
    expect(await memlet.list(), 'memlet after write flush').to.deep.equal({
      [filename]: 'file'
    })
    expect(await disklet.list(), 'disklet after write flush').to.deep.equal({
      [filename]: 'file'
    })

    // Delete file
    await memlet.delete(filename)

    // Assertions after delete
    expect(await memlet.list(), 'memlet after delete').to.deep.equal({})
    expect(await disklet.list(), 'disklet after delete').to.deep.equal({
      [filename]: 'file'
    })

    // Wait for delete action to be flushed
    await memlet.onFlush.next().value

    // Assertions after delete action flush
    expect(await memlet.list(), 'memlet after delete flush').to.deep.equal({})
    expect(await disklet.list(), 'disklet after delete flush').to.deep.equal({})
  })
})
