import {nonCircularObjectCloning} from '../util/util'
import {readFile} from '../util/file'
import { Parser } from '@dbml/core'
import generateDatabaseTypes from './types'
import generateDatabaseHelpers from './helpers'

export async function generateDatabaseTypesAndSchemas(){

    const dbml = loadDbml('../database/schema.dbml')

    const tables = nonCircularObjectCloning(dbml.schema).schemas[0].tables

    await generateDatabaseTypes(tables, dbml.string)

    generateDatabaseHelpers(tables, dbml.string)
}


function loadDbml(filePath: string){
    const dbmlString = readFile(filePath)

    return {
        string: dbmlString,
        schema: Parser.parse(dbmlString, 'dbml')
    }
}
