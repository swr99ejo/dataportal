import { createReadStream } from 'fs'
import { promises as fsp }  from 'fs'
import { basename, join, resolve as pathResolve } from 'path'
import { createHash } from 'crypto'
import 'reflect-metadata'
import { Connection } from 'typeorm'
import { File, FileStatus } from './entity/File'
import { Site } from './entity/Site'
import { isNetCDFObject, getMissingFields, NetCDFObject } from './entity/NetCDFObject'
import { spawn } from 'child_process'
import { stringify } from './lib'
import config from './config'
import { Product } from './entity/Product'


let filename: string

interface NetCDFXML {
    netcdf: {
        attribute: Array<{
            '$': {
                name: string
                value: string
            }
        }>
        '$': { location: string }
    }
}

const findVolatileFile = (conn: Connection, uuid: string): Promise<File|null> =>
  new Promise((resolve, reject) =>
    conn.getRepository(File).findOneOrFail(uuid, { relations: [ 'site' ]})
      .then(file => {
        if (!file.site.isTestSite && file.status === FileStatus.FREEZED)
          reject('Cannot update a freezed file.')
        else
          resolve(file)
      })
      .catch(_ => resolve(null))
  )

const update = (file: File, connection: Connection) =>
  Promise.all([
    computeFileChecksum(filename),
    computeFileSize(filename),
    getFileFormat(filename)
  ]).then(([checksum, { size }, format]) => {
    const repo = connection.getRepository(File)
    return repo.save({ uuid: file.uuid, checksum, size, format, releasedAt: new Date() })
  })

const insert = (ncObj: NetCDFObject, connection: Connection) =>
  Promise.all([
    ncObj,
    basename(filename),
    computeFileChecksum(filename),
    computeFileSize(filename),
    getFileFormat(filename),
    checkSiteExists(connection, ncObj.location),
    checkProductExists(connection, ncObj.cloudnet_file_type),
    linkFile(filename)
  ]).then(([ncObj, baseFilename, chksum, { size }, format, site, product]) => {
    const file = new File(ncObj, baseFilename, chksum, size, format, site, product)
    return connection.manager.save(file)
  })

const checkSiteExists = (conn: Connection, site: string): Promise<Site> =>
  conn.getRepository(Site).findOneOrFail(site.toLowerCase().replace(/\W/g, ''))

const checkProductExists = (conn: Connection, product: string): Promise<Product> =>
  conn.getRepository(Product).findOneOrFail(product)

async function computeFileChecksum(filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const hash = createHash('sha256')
      const input = createReadStream(filename)
      input.on('readable', () => {
        const data = input.read()
        if (data)
          hash.update(data)
        else {
          const chksum = hash.digest('hex')
          resolve(chksum)
        }
      })
    } catch (err) {
      reject(err)
    }
  })
}

function computeFileSize(filename: string) {
  return fsp.stat(filename)
}

function linkFile(filename: string) {
  const linkPath = config.publicDir
  return fsp.symlink(pathResolve(filename), join(linkPath, basename(filename)))
}

function getFileFormat(filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('file', [filename])

    let out: string
    proc.stdout.on('data', data => out += data)
    proc.on('close', () => {
      if (out.includes('NetCDF Data Format data')) {
        resolve('NetCDF3')
      } else if (out.includes('Hierarchical Data Format (version 5) data')) {
        resolve('HDF5 (NetCDF4)')
      } else {
        reject(`Unknown file type ${  out}`)
      }
    })
  })
}

function parseJSON(json: any) {
  const { netcdf }: NetCDFXML = json
  filename = 'inbox' + '/' + netcdf['$'].location
  const ncObj: any = netcdf.attribute
    .map((a) => a['$'])
    .map(({ name, value }) => ({ [name]: value }))
    .reduce((acc, cur) => Object.assign(acc, cur))

  if (!isNetCDFObject(ncObj)) {
    const missingFields = getMissingFields(ncObj)
    throw (`Invalid header fields\n
          Missing or invalid: ${stringify(missingFields)}\n
          ${stringify(ncObj)}`)
  }  
  return ncObj
}

async function readFileRow(connection: Connection, uuid: string){
  try { 
    return await connection
      .getRepository(File)
      .createQueryBuilder()
      .where("uuid = :uuid", { uuid: uuid })
      .getOne() 
  } catch(e) {
    throw e
  }
}

export async function putRecord(connection: Connection, input: any) {
  try {    
    const ncObj = parseJSON(input)  
    const existingFile = await findVolatileFile(connection, ncObj.file_uuid)
    if (existingFile) {
      await update(existingFile, connection)
    } else {
      await insert(ncObj, connection)
    }
    return await readFileRow(connection, ncObj.file_uuid)
  } catch(e) {
    throw e
  }
}

export async function freezeRecord(result: any, connection: Connection, pid: string, freeze: boolean) {
  if (!freeze) return result
  try {
    await connection
      .getRepository(File)
      .createQueryBuilder()
      .update()
      .set({ pid: pid, status: FileStatus.FREEZED})
      .where("uuid = :uuid", { uuid: result.uuid })
      .execute()
    return await readFileRow(connection, result.uuid)
  } catch(e) {
    throw e
  }
}
