import Table from "@dbml/core/types/model_structure/table";
import {  saveToFile } from "../util/file";
import { camelcasify } from "../util/util";
import {convertDBMLTypeToTypescriptType, noteIsValidStateDefinition} from '../util/dbml'

export default function generateDatabaseHelpers(tables: Table[], dbmlString: string){
    console.log('generate DB Helpers ...')//TODO refactor to generate DBInsert and DBUpdate in the generateDBTypes.js file, so its all in one place (// TODO is this still required?)

    const tableDefinitions: {[key: string]: {
        columns: {name: string}[]
        insertTypes: string[]
        updateTypes: string[]
        typesToImport: string[]
    }} = {}

    for(const table of tables){
        if(table){
            let tableName = table.name

            if(tableName === ''){
                console.error(table)
                throw new Error('table.name is invalid: ' + tableName)
            }

            const columns: {name: string, cnd?: boolean, skip?: string}[] = []
            const insertTypes: string[] = []
            const updateTypes: string[] = []
            const typesToImport: string[] = []

            for(const field of table.fields){

                const isXAutomatic = field.note === 'x-automatic'

                if(isXAutomatic){
                    //skip
                    continue
                }

                const isSequence = field.type.type_name === 'serial'

                const isOptional = field.not_null !== true || field.dbdefault

                const name = field.name

                const col: typeof columns[0] = {
                    name
                }

                if(isSequence){
                    col.cnd = true
                } else {
                    if(isOptional){
                        col.skip = '$COLERA$' // replaced later
                    }
                }

                columns.push(col)

                if(!isSequence){

                    let type

                    if(noteIsValidStateDefinition(field.note)){
                        type = 'DBType_' + normalizeTableName(tableName) + '_' + camelcasify(field.name) + 'Type'
                        typesToImport.push(type)
                    } else {
                        type = convertDBMLTypeToTypescriptType(field.type.type_name)
                    }

                    insertTypes.push(name + ((isSequence || isOptional) ? '?' : '') + ': ' + type)
                    updateTypes.push(name + '?: ' + type)
                }

            }

            tableDefinitions[tableName] = {
                columns,
                insertTypes,
                updateTypes,
                typesToImport
            }
        }
    }


    let exportString = `import * as pgp from 'pg-promise'
    const db : pgp.IDatabase<any> = global.db\n\n`

    for(const tableName of Object.keys(tableDefinitions)){

        const tableDefinition = tableDefinitions[tableName]

        exportString += '\n\n\n//' + tableName

        let dbTypeName = normalizeTableName(tableName)
        if(tableDefinition.typesToImport){
            exportString += '\n\nimport {' + tableDefinition.typesToImport.join(', ') + '} from "./DBTypes";'
        }
        exportString += '\n\nexport type DBInsert_' + dbTypeName + ' = {\n' + tableDefinition.insertTypes.map(v => '    ' + v).join('\n') + '\n}'
        exportString += '\n\nexport type DBUpdate_' + dbTypeName + ' = {\n' + tableDefinition.updateTypes.map(v => '    ' + v).join('\n') + '\n}'

        const columSetName = 'COLUMN_SET_' + tableName.toUpperCase()
        const columSetNameUpdate = columSetName + '_UPDATE'

        exportString += '\nconst ' + columSetName + ' = new db.$config.pgp.helpers.ColumnSet(' + JSON.stringify(tableDefinitions[tableName].columns, null, 4).replace(/"\$COLERA\$"/g, 'col => !col.exists') + ', {table: "' + tableName + '"})\n'

        exportString += '\nconst ' + columSetNameUpdate + ' = new db.$config.pgp.helpers.ColumnSet(' + JSON.stringify(tableDefinitions[tableName].columns.map(col => {
            return {name: col.name, skip: '$COLERA$'}
        }), null, 4).replace(/"\$COLERA\$"/g, 'col => !col.exists') + ', {table: "' + tableName + '"})'

        exportString += `\nimport {DBType_${dbTypeName}} from './DBTypes'\n`

        exportString += `\n
    export function insert${normalizeTableName(tableName)}(values: DBInsert_${dbTypeName}){
        return db.one<DBType_${dbTypeName}>(db.$config.pgp.helpers.insert(values, undefined, '${tableName}') + ' RETURNING *')
    }`

        exportString += `\n\n/**
    @param idOrWhereCondition is either a single id or a where clause which shall be generated with pgp.as.format() e.g. pgp.as.format('WHERE id = \${id}', {id: 42})
    */
    export function update${normalizeTableName(tableName)}<T extends number | string>(values: DBUpdate_${dbTypeName}, idOrWhereCondition: T): T extends number ? Promise<DBType_${dbTypeName}> : Promise<DBType_${dbTypeName}[]>{
        if(typeof idOrWhereCondition === 'number'){
            const id = idOrWhereCondition as number
            //@ts-ignore
            return db.one<DBType_${dbTypeName}>(db.$config.pgp.helpers.update(values,  ${columSetNameUpdate}) + ' WHERE id = ' + id + ' RETURNING *')
        } else {
            let whereCondition = idOrWhereCondition as string
            whereCondition = whereCondition.trim()
            if(whereCondition.endsWith(';')){
                whereCondition = whereCondition.substring(0, whereCondition.length - 1)
            }

            return db.none(db.$config.pgp.helpers.update(values,  ${columSetNameUpdate}) + ' ' + whereCondition)
        }
    }

    export function delete${normalizeTableName(tableName)}(id: number){
        return db.one<DBType_${dbTypeName}>('DELETE FROM ${tableName} WHERE id = \${id} RETURNING *', {id})
    }

    `

    if(tableDefinition.columns.find(el => el.name === 'id')){

        exportString += `\n\n
    export function select${normalizeTableName(tableName)}(id: number){
        return db.one<DBType_${dbTypeName}>('SELECT * FROM ${tableName} ' + pgp.as.format('WHERE id = \${id}', {id}))
    }`
    }

    }

    saveToFile(exportString, '../api/src/generated-definitions/db/DBHelpers.ts')

    console.log('  done helpers for (' + tables.length + ' tables exported)')
}

function normalizeTableName(tableName: string){
    let normed = camelcasify(tableName)
    if(normed.endsWith('s')){
        normed = normed.substring(0, normed.length - 1)
    }

    return normed
}

