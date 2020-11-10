import { assert, expect } from 'chai'
import { makeMemoryDisklet, makeNodeDisklet } from 'disklet'
import { describe, it } from 'mocha'

import { makeMemlet, Memlet, _getMemletState } from '../src/index'

export async function createObjects(memlet: Memlet) {
  const fileA = { content: 'file content' }
  const folderA = { content: 'folder content' }
  const fileB = { content: 'subfolder content' }

  memlet.setJson('File-A', fileA)
  memlet.setJson('Folder-A', folderA)
  memlet.setJson('Folder-A/File-B', fileB)

  return { fileA, folderA, fileB }
}

describe('Memlet', async () => {
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
})
