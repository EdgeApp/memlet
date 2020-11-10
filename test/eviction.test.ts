import { expect } from 'chai'
import { makeMemoryDisklet } from 'disklet'
import { describe, it } from 'mocha'

import {
  makeMemlet,
  resetMemletState,
  setMemletConfig,
  _getMemletState
} from '../src/index'
import {
  delay,
  getNormalizeStoreFilenames,
  measureDataSize,
  measureMaxMemoryUsage
} from './utils'

import { beforeEach } from 'mocha'

describe('Memlet with evictions', async () => {
  beforeEach('reset memlet state', () => {
    resetMemletState()
  })

  const state = _getMemletState()

  it('can add files within maxMemoryUsage', async () => {
    const fileA = { content: 'some content' }
    const fileASize = measureDataSize(fileA)

    setMemletConfig({ maxMemoryUsage: fileASize })

    const disklet = makeMemoryDisklet()
    const memlet = makeMemlet(disklet)

    await memlet.setJson('File-A', fileA)

    // Check files
    expect(getNormalizeStoreFilenames(state)).deep.equals(['File-A'])
    // Check memoryUsage
    expect(measureMaxMemoryUsage(state.store.memoryUsage)).to.equal(fileASize)
  })

  it('will remove old files when exceeding maxMemoryUsage', async () => {
    const fileA = { content: 'some content' }
    const fileB = { content: 'some other content' }
    const fileBSize = measureDataSize(fileB)

    setMemletConfig({ maxMemoryUsage: fileBSize })

    const disklet = makeMemoryDisklet()
    const memlet = makeMemlet(disklet)

    await memlet.setJson('File-A', fileA)
    await delay(10)
    await memlet.setJson('File-B', fileB)

    // Check files
    expect(getNormalizeStoreFilenames(state)).deep.equals(['File-B'])
    // Check memoryUsage
    expect(measureMaxMemoryUsage(state.store.memoryUsage)).to.equal(fileBSize)
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
      measureDataSize(largeFile) + measureDataSize(fileE) * 2

    setMemletConfig({ maxMemoryUsage })

    const disklet = makeMemoryDisklet()
    const memlet = makeMemlet(disklet)

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

    expect(getNormalizeStoreFilenames(state)).deep.equals([
      'File-D',
      'File-E',
      'Large-File'
    ])
  })

  it('will evict file after reading a persisted file', async () => {
    const fileA = { content: 'some content' }
    const fileB = { content: 'some content' }

    const maxMemoryUsage = measureDataSize(fileA)

    setMemletConfig({ maxMemoryUsage })

    const disklet = makeMemoryDisklet()

    // Persisted file
    await disklet.setText('File-A', JSON.stringify(fileA))

    const memlet = makeMemlet(disklet)

    await memlet.setJson('File-B', fileB)

    expect(getNormalizeStoreFilenames(state)).deep.equals(['File-B'])

    await delay(1)
    await memlet.getJson('File-A')

    expect(getNormalizeStoreFilenames(state)).deep.equals(['File-A'])
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
      measureDataSize(largeFile) + measureDataSize(fileE) * 2

    setMemletConfig({ maxMemoryUsage })

    const disklet = makeMemoryDisklet()

    // Persisted file
    await disklet.setText('Large-File', JSON.stringify(largeFile))

    const memlet = makeMemlet(disklet)

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

    expect(getNormalizeStoreFilenames(state)).deep.equals([
      'File-D',
      'File-E',
      'Large-File'
    ])
  })

  it('will evict files after reading and writing files many times', async () => {
    const fileData = { content: 'some content' }

    const maxMemoryUsage = measureDataSize(fileData) * 3

    setMemletConfig({ maxMemoryUsage })

    const disklet = makeMemoryDisklet()

    const memlet = makeMemlet(disklet)

    await memlet.setJson('File-A', fileData)

    await memlet.setJson('File-B', fileData)

    await memlet.setJson('File-C', fileData)

    await memlet.setJson('File-D', fileData)

    await memlet.setJson('File-E', fileData)

    expect(getNormalizeStoreFilenames(state)).deep.equals([
      'File-C',
      'File-D',
      'File-E'
    ])

    await delay(10)

    await memlet.getJson('File-B')

    await memlet.getJson('File-A')

    expect(getNormalizeStoreFilenames(state)).deep.equals([
      'File-E',
      'File-B',
      'File-A'
    ])

    await delay(10)

    await memlet.setJson('File-F', fileData)

    expect(getNormalizeStoreFilenames(state)).deep.equals([
      'File-B',
      'File-A',
      'File-F'
    ])

    await delay(10)

    await memlet.getJson('File-C')
    await memlet.getJson('File-D')
    await memlet.getJson('File-E')

    expect(getNormalizeStoreFilenames(state)).deep.equals([
      'File-C',
      'File-D',
      'File-E'
    ])
  })
})
