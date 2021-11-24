import { expect } from 'chai'
import { makeMemoryDisklet } from 'disklet'
import { describe, it } from 'mocha'

import { makeMemlet, notFoundErrorMessageRegex } from '../src'

describe('Error optimizations', () => {
  it('cannot interfere with list', async () => {
    const disklet = makeMemoryDisklet()
    const memlet = makeMemlet(disklet)

    expect(await memlet.list()).deep.equals({})

    await expect(memlet.getJson('unavailable')).to.rejectedWith(
      notFoundErrorMessageRegex
    )

    expect(await memlet.list()).deep.equals({})
  })
})
