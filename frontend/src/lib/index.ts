import { File } from '../../../backend/src/entity/File'
import {Visualization} from '../../../backend/src/entity/Visualization'

export const getIconUrl = (product: string) =>
  require(`../assets/icons/${product}.png`)

export const humanReadableSize = (size: number) => {
  if (size == 0) return '0 B'
  const i = Math.floor( Math.log(size) / Math.log(1024) )
  return `${( size / Math.pow(1024, i) ).toFixed(1)  } ${  ['B', 'kB', 'MB', 'GB', 'TB'][i]}`
}

export const humanReadableDate = (date: string) =>
  new Date(date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })

export const combinedFileSize = (files: File[]) =>
  files.map(file => file.size).reduce((prev, cur) => cur + prev, 0)

export const dateToUTC = (date: Date) =>
  new Date(date.getTime() - (date.getTimezoneOffset() * 60000))

export const dateToString = (date: Date) => {
  const utcTime = dateToUTC(date)
  return utcTime.toISOString().substring(0,10)
}

export const sortVisualizations = (visualizations: Visualization[]) => {
  return visualizations.sort((a: Visualization, b: Visualization) => {
    if (a.productVariable.order == b.productVariable.order) return 0
    if (a.productVariable.order < b.productVariable.order) return -1
    return 1
  })
}
