import { expect } from 'chai'
import { makeMemoryDisklet } from 'disklet'
import { describe, it } from 'mocha'

import { makeMemlet } from '../src/index'
import { delay } from './utils'

describe('Memlet with evictions', async () => {
  it('can add files within maxMemoryUsage', async () => {
    const fileA = { content: 'some content' }
    const fileASize = JSON.stringify(fileA).length

    const disklet = makeMemoryDisklet()
    const memlet = makeMemlet(disklet, { maxMemoryUsage: fileASize })
    const store = memlet._getStore()

    await memlet.setJson('File-A', fileA)

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
    const store = memlet._getStore()

    await memlet.setJson('File-A', fileA)
    await delay(10)
    await memlet.setJson('File-B', fileB)

    // Check files
    expect(Object.keys(store.files)).deep.equals(['File-B'])
    // Check memoryUsage
    expect(store.memoryUsage).to.equal(fileBSize)
  })

  it('will remove multiple small files after a large file', async () => {
    const fileA = { content: 'some content' }
    const fileB = { content: 'some content' }
    const fileC = { content: 'some content' }
    const fileD = { content: 'some content' }
    const fileE = { content: 'some content' }
    const largeFile = {
      content: `lots and lots and lots and lots and lots and lots and lots 
      and lots and lots and lots and lots and lots and lots and lots and 
      lots and lots of content`
    }

    const maxMemoryUsage =
      JSON.stringify(largeFile).length + JSON.stringify(fileE).length * 2

    const disklet = makeMemoryDisklet()
    const memlet = makeMemlet(disklet, {
      maxMemoryUsage
    })
    const store = memlet._getStore()

    await memlet.setJson('File-A', fileA)
    await delay(1)
    await memlet.setJson('File-B', fileB)
    await delay(1)
    await memlet.setJson('File-C', fileC)
    await delay(1)
    await memlet.setJson('File-D', fileD)
    await delay(1)
    await memlet.setJson('File-E', fileE)
    await delay(1)
    await memlet.setJson('Large-File', largeFile)

    expect(Object.keys(store.files)).deep.equals([
      'File-D',
      'File-E',
      'Large-File'
    ])
  })

  it('will evict file after reading a persisted file', async () => {
    const fileA = { content: 'some content' }
    const fileB = { content: 'some content' }

    const maxMemoryUsage = JSON.stringify(fileA).length

    const disklet = makeMemoryDisklet()

    // Persisted file
    await disklet.setText('File-A', JSON.stringify(fileA))

    const memlet = makeMemlet(disklet, {
      maxMemoryUsage
    })
    const store = memlet._getStore()

    await memlet.setJson('File-B', fileB)
    await delay(1)
    await memlet.getJson('File-A')

    expect(Object.keys(store.files)).deep.equals(['File-A'])
  })

  it('will evict multiple files after reading a large persisted file', async () => {
    const fileA = { content: 'some content' }
    const fileB = { content: 'some content' }
    const fileC = { content: 'some content' }
    const fileD = { content: 'some content' }
    const fileE = { content: 'some content' }
    const largeFile = {
      content: `lots and lots and lots and lots and lots and lots and lots 
      and lots and lots and lots and lots and lots and lots and lots and 
      lots and lots of content`
    }

    const maxMemoryUsage =
      JSON.stringify(largeFile).length + JSON.stringify(fileE).length * 2

    const disklet = makeMemoryDisklet()

    // Persisted file
    await disklet.setText('Large-File', JSON.stringify(largeFile))

    const memlet = makeMemlet(disklet, {
      maxMemoryUsage
    })
    const store = memlet._getStore()

    await memlet.setJson('File-A', fileA)
    await delay(1)
    await memlet.setJson('File-B', fileB)
    await delay(1)
    await memlet.setJson('File-C', fileC)
    await delay(1)
    await memlet.setJson('File-D', fileD)
    await delay(1)
    await memlet.setJson('File-E', fileE)
    await delay(1)
    await memlet.getJson('Large-File')

    expect(Object.keys(store.files)).deep.equals([
      'File-D',
      'File-E',
      'Large-File'
    ])
  })

  it('will evict files after reading and writing files many times', async () => {
    const fileData = { content: 'some content' }

    const maxMemoryUsage = JSON.stringify(fileData).length * 3

    const disklet = makeMemoryDisklet()

    const memlet = makeMemlet(disklet, {
      maxMemoryUsage
    })
    const store = memlet._getStore()

    await memlet.setJson('File-A', fileData)

    await memlet.setJson('File-B', fileData)

    await memlet.setJson('File-C', fileData)

    await memlet.setJson('File-D', fileData)

    await memlet.setJson('File-E', fileData)

    expect(Object.keys(store.files)).deep.equals(['File-C', 'File-D', 'File-E'])

    await delay(10)

    await memlet.getJson('File-B')

    await memlet.getJson('File-A')

    expect(Object.keys(store.files)).deep.equals(['File-E', 'File-B', 'File-A'])

    await delay(10)

    await memlet.setJson('File-F', fileData)

    expect(Object.keys(store.files)).deep.equals(['File-B', 'File-A', 'File-F'])

    await delay(10)

    await memlet.getJson('File-C')
    await memlet.getJson('File-D')
    await memlet.getJson('File-E')

    expect(Object.keys(store.files)).deep.equals(['File-C', 'File-D', 'File-E'])
  })
})
