import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { makeMemoryDisklet } from 'disklet'
import { describe, it } from 'mocha'

use(chaiAsPromised)

import {
  _getMemletState,
  makeMemlet,
  setMemletConfig,
  resetMemletState
} from '../src/index'
import {
  delay,
  getNormalizeStoreFilenames,
  measureDataSize,
  measureMaxMemoryUsage
} from './utils'

describe('Memlets with shared state', async () => {
  beforeEach('reset memlet state', () => {
    resetMemletState()
  })

  const state = _getMemletState()

  it('will evict files when exceeding shared maxMemoryUsage', async () => {
    const diskletA = makeMemoryDisklet()
    const diskletB = makeMemoryDisklet()
    const memletA = makeMemlet(diskletA)
    const memletB = makeMemlet(diskletB)

    const fileA = { content: 'some content' }
    const fileB = { content: 'some other content' }
    const fileBSize = measureDataSize(fileB)

    setMemletConfig({ maxMemoryUsage: fileBSize })

    await memletA.setJson('File-A', fileA)
    await delay(10)
    await memletB.setJson('File-B', fileB)

    // Check memoryUsage
    expect(measureMaxMemoryUsage(state.store.memoryUsage)).to.equal(fileBSize)
    // Check files
    expect(getNormalizeStoreFilenames(state)).deep.equals(['File-B'])
  })

  it('will not share file paths', async () => {
    const diskletA = makeMemoryDisklet()
    const diskletB = makeMemoryDisklet()
    const memletA = makeMemlet(diskletA)
    const memletB = makeMemlet(diskletB)

    const fileA = { content: 'some content' }
    const fileB = { content: 'some other content' }

    await memletA.setJson('File-A', fileA)
    await delay(10)
    await memletB.setJson('File-B', fileB)
    await delay(1)

    expect(getNormalizeStoreFilenames(state)).deep.equals(['File-A', 'File-B'])

    // Can access files
    await memletA.getJson('File-A')
    await memletB.getJson('File-B')

    // Cannot access files
    expect(memletA.getJson('File-B')).to.be.rejectedWith('Cannot load "File-B"')
    expect(memletB.getJson('File-A')).to.be.rejectedWith('Cannot load "File-A"')
  })
})
