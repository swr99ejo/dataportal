import {File} from './File'

export class SearchFileResponse {

  uuid: string
  measurementDate: Date
  site: string
  product: string
  productId: string
  size: number
  volatile: boolean

  constructor(file: File) {
    this.uuid = file.uuid
    this.measurementDate = file.measurementDate
    this.site = file.site.humanReadableName
    this.product = file.product.humanReadableName
    this.productId = file.product.id
    this.size = file.size
    this.volatile = file.volatile
  }
}
