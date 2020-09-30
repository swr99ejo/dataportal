/* eslint-disable @typescript-eslint/no-explicit-any */
import {Wrapper} from '@vue/test-utils'
import axios, {AxiosPromise, AxiosRequestConfig} from 'axios'
import Vue from 'vue'
import {augmentAxiosResponse, init, mountVue, nextTick} from './lib'
import {mocked} from 'ts-jest/dist/util/testing'
import {readResources} from '../../shared/lib'
import Site from '../src/views/Site.vue'

init()

jest.mock('axios')

let axiosMockWithIndices: Function
let resources: any
let wrapper: Wrapper<Vue>

describe('Site.vue', () => {
  beforeAll(async () => {
    resources = await readResources()
    axiosMockWithIndices = (siteIdx: number, searchIdx: number, instruments = []) => {
      return (url: string, _: AxiosRequestConfig | undefined): AxiosPromise => {
        if (url.includes('site')) {
          return Promise.resolve(augmentAxiosResponse(resources['sites'][siteIdx]))
        } else if (url.includes('search')) {
          return Promise.resolve(augmentAxiosResponse([resources['allsearch'][searchIdx]]))
        } else { // metadata-upload
          return Promise.resolve(augmentAxiosResponse(instruments))
        }
      }
    }
  })

  it('displays basic information', async () => {
    const expected = [
      'Bucharest, Romania',
      '44.348° N, 26.029° E',
      '93 m',
      '2019-07-16'
    ]
    mocked(axios.get).mockImplementation(axiosMockWithIndices(0, 8))
    wrapper = mountVue(Site)
    await nextTick(1)
    const summaryText = await wrapper.find('#summary').text()
    return expected.forEach(str => expect(summaryText).toContain(str))
  })

  it('displays instruments when they are found', async () => {
    const expected = [
      'chm15k',
      'mira'
    ]
    mocked(axios.get).mockImplementation(axiosMockWithIndices(0, 8, resources['uploaded-metadata-public']))
    wrapper = mountVue(Site)
    await nextTick(1)
    const instrumentText = await wrapper.find('#instruments').text()
    return expected.forEach(str => expect(instrumentText).toContain(str))
  })

  it('displays notification when instruments are not found', async () => {
    mocked(axios.get).mockImplementation(axiosMockWithIndices(1, 0))
    wrapper = mountVue(Site)
    await nextTick(1)
    const instrumentText = await wrapper.find('#instruments').text()
    return expect(instrumentText).toContain('not available')
  })
})
