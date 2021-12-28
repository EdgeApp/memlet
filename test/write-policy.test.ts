import { expect } from 'chai'
import { DiskletListing, makeMemoryDisklet } from 'disklet'
import { describe, it } from 'mocha'

import { delay } from '../src/helpers/delay'
import {
  DRAIN_INTERVAL,
  makeMemlet,
  MAX_BATCH_SIZE,
  notFoundErrorMessageRegex
} from '../src/index'
import { listCacheOnly } from './utils'

describe('Memlet write-policy', () => {
  it('will write files to write-back after drain-delay', async () => {
    const disklet = makeMemoryDisklet()
    const memlet = makeMemlet(disklet)
    await memlet.setJson('a', 'xxx')

    // Immediate cache-store and backing-store state
    expect(await disklet.list()).deep.equals({})
    expect(await memlet.list()).deep.equals({ a: 'file' })

    await delay(DRAIN_INTERVAL)

    // State after drain delay
    expect(await disklet.list()).deep.equals({ a: 'file' })
    expect(await memlet.list()).deep.equals({ a: 'file' })
  })

  it('will write files to backing-store in batches after each drain-delay', async () => {
    const disklet = makeMemoryDisklet()
    const memlet = makeMemlet(disklet)

    // Number of batches to test
    const batchCount = 3
    // An array of file lists, one for each batch
    const fileLists: DiskletListing[] = Array.from({
      length: batchCount
    }).map(_ => ({}))

    //
    // Step 1: Create the file lists fixtures
    ///
    for (let batchIndex = 0; batchIndex < batchCount; ++batchIndex) {
      for (let fileIndex = 0; fileIndex < MAX_BATCH_SIZE; ++fileIndex) {
        // It's important that the file name is lexicographically sortable
        // because we're not delaying between file writes, so all writes occur
        // roughly at the same time.
        // If we delay between file writes, we will have to account for the
        // delays in the test step.
        const filename = `batch-${batchIndex}_file-${fileIndex}`

        // Save list item to the correct file list
        fileLists[batchIndex][filename] = 'file'

        // Write the file to cache
        await memlet.setJson(filename, 'xxx')
      }
    }
    // Create a list of all the files in the cache
    const allFileLists = fileLists.reduce((acc, fileList) => {
      return { ...acc, ...fileList }
    }, {})

    //
    // Step 2:Test that the cache writes batches to the backing-store correctly
    //
    for (let i = 0; i <= batchCount; ++i) {
      // This is the test context message (useful for debugging if test fails)
      const testContextMessage =
        i === 0 ? 'before drains' : `after drain batch ${i}`

      // Expect that the cache has the correct state
      expect(
        listCacheOnly(memlet._instanceId),
        `memlet files ${testContextMessage}`
      ).deep.equals(allFileLists)

      // Expect that the backing store has the correct state
      const diskletFiles = fileLists.slice(0, i).reduce((acc, fileList) => {
        return { ...acc, ...fileList }
      }, {})
      expect(
        await disklet.list(),
        `disklet files ${testContextMessage}`
      ).deep.equals(diskletFiles)

      // Wait for the drain interval before continuing loop
      await delay(DRAIN_INTERVAL)
    }
  })

  it('will delete files from cache and then backing-store', async () => {
    const disklet = makeMemoryDisklet()
    const memlet = makeMemlet(disklet)

    await memlet.setJson('aaa', 'xxx')
    await memlet.setJson('bbb', 'xxx')
    await memlet.setJson('ccc', 'xxx')

    await memlet.onFlush.next().value

    expect(
      listCacheOnly(memlet._instanceId),
      `memlet files before delete`
    ).deep.equals({
      aaa: 'file',
      bbb: 'file',
      ccc: 'file'
    })
    expect(await disklet.list(), `disklet files before delete`).deep.equals({
      aaa: 'file',
      bbb: 'file',
      ccc: 'file'
    })

    await memlet.delete('aaa')

    expect(
      listCacheOnly(memlet._instanceId),
      `memlet files after delete`
    ).deep.equals({
      bbb: 'file',
      ccc: 'file'
    })
    expect(await disklet.list(), `disklet files after delete`).deep.equals({
      aaa: 'file',
      bbb: 'file',
      ccc: 'file'
    })

    await memlet.onFlush.next().value

    expect(
      await disklet.list(),
      `disklet files after delete and flush`
    ).deep.equals({
      bbb: 'file',
      ccc: 'file'
    })
  })

  it('wont recover a deleted file from backing-store after read ', async () => {
    // make a disklet and a memlet
    const disklet = makeMemoryDisklet()
    const memlet = makeMemlet(disklet)

    // write a file to memlet
    await memlet.setJson('deleted-file', 'deleted-file content')

    // Wait until flush event
    await memlet.onFlush.next().value

    // delete the file from memlet
    await memlet.delete('deleted-file')

    // Read the file from memlet, expecting the promise to reject with a not found error
    await expect(
      memlet.getJson('deleted-file'),
      'file should not be recovered'
    ).to.eventually.be.rejectedWith(notFoundErrorMessageRegex)

    // List files from memlet, and expect list to be empty
    expect(await memlet.list(), `memlet files after delete`).deep.equals({})
  })
})
