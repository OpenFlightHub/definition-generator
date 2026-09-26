import Table from "@dbml/core/types/model_structure/table";
import {  saveToFile } from "../util/file";
import { camelcasify } from "../util/util";
import {convertDBMLTypeToTypescriptType, noteIsValidStateDefinition} from '../util/dbml'

export default function generateDatabaseHelpers(tables: Table[], dbmlString: string){
    console.log('generate DB Helpers ...')//TODO refactor to generate DBInsert and DBUpdate in the generateDBTypes.js file, so its all in one place (// TODO is this still required?)

    const tableDefinitions: {[key: string]: {
        columns: {
            name: string
            cnd?: boolean
            skip?: string
            isGeometry: boolean
        }[]
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

            const columns: typeof tableDefinitions[string]['columns'] = []
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
                    name,
                    isGeometry: field.type.type_name === 'geometry'
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

                    insertTypes.push(type === 'geometry' ? (name + ': ST_Geometry') : (name + ((isSequence || isOptional) ? '?' : '') + ': ' + type))
                    updateTypes.push(type === 'geometry' ? (name + '?: ST_Geometry') : (name + '?: ' + type))
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


    let exportString = `import * as pgp from 'pg-promise'\n//@ts-ignore\nconst db : pgp.IDatabase<any> = global.db\n\nimport { ST_Geometry } from '../../util/postgis';\n\n

    export function replaceGeometryWithParsed(rows: any[], originalColumn: string, geoJsonColumn: string){
        for(const row of rows){
            row[originalColumn] = ST_Geometry.fromGeoJSON(JSON.parse(row[geoJsonColumn]))
            delete row[geoJsonColumn]
        }
    }
    `

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


        function makeSelectAll(){
            return ['*' , ...tableDefinition.columns.filter(c => c.isGeometry).map(c => 'ST_AsGeoJSON(geom) as ' + c.name + '_parsed')].join(', ')
        }

        function makeGeometryReplaceString(single = false){
            return tableDefinition.columns.filter(c => c.isGeometry).map(c => 'replaceGeometryWithParsed(' + (single ? '[ret]' : 'ret') + ', \'' + c.name + '\', \'' + c.name + '_parsed\')').join('\n')
        }

        function cleanColumnForPg(col: typeof tableDefinition.columns[0]){
            return {
                name: col.name,
                cnd: col.cnd,
                skip: col.skip
            }
        }

        exportString += '\nconst ' + columSetName + ' = new db.$config.pgp.helpers.ColumnSet(' + JSON.stringify(tableDefinitions[tableName].columns.map(cleanColumnForPg), null, 4).replace(/"\$COLERA\$"/g, '(col: {exists: boolean}) => !col.exists') + ', {table: "' + tableName + '"})\n'

        exportString += '\nconst ' + columSetNameUpdate + ' = new db.$config.pgp.helpers.ColumnSet(' + JSON.stringify(tableDefinitions[tableName].columns.map(cleanColumnForPg).map(col => {
            return {name: col.name, skip: '$COLERA$'}
        }), null, 4).replace(/"\$COLERA\$"/g, '(col: {exists: boolean}) => !col.exists') + ', {table: "' + tableName + '"})'

        exportString += `\nimport {DBType_${dbTypeName}} from './DBTypes'\n`

        exportString += `\n
    export async function insert_${normalizeTableName(tableName)}(values: DBInsert_${dbTypeName}){
        const ret = await db.one<DBType_${dbTypeName}>(db.$config.pgp.helpers.insert(values, undefined, '${tableName}') + ' RETURNING ${makeSelectAll()}')

        ${makeGeometryReplaceString(true)}

        return ret
    }`

        exportString += `\n\n    /**
    @param idOrWhereCondition is either a single id or a where clause which shall be generated with pgp.as.format() e.g. pgp.as.format('WHERE id = \${id}', {id: 42})
    */
    export async function update_${normalizeTableName(tableName)}<T extends number | string>(idOrWhereCondition: T, values: DBUpdate_${dbTypeName}): Promise<T extends number ? false | DBType_${dbTypeName} : DBType_${dbTypeName}[]>{

        ${tableDefinition.columns.find(c => c.name === 'updated_at') ? 'if(!values.updated_at){values.updated_at = new Date().toISOString()}' : ''}

        if(typeof idOrWhereCondition === 'number'){
            const id = idOrWhereCondition as number
            const ret = await db.oneOrNone<DBType_${dbTypeName}>(db.$config.pgp.helpers.update(values,  ${columSetNameUpdate}) + ' WHERE id = ' + id + ' RETURNING ${makeSelectAll()}')

            if(!ret){
                //@ts-ignore
                return false
            }

            ${makeGeometryReplaceString(true)}

            //@ts-ignore
            return ret

        } else {
            let whereCondition = idOrWhereCondition as string
            whereCondition = whereCondition.trim()
            if(whereCondition.endsWith(';')){
                whereCondition = whereCondition.substring(0, whereCondition.length - 1)
            }

            const ret = await db.manyOrNone<DBType_${dbTypeName}>(db.$config.pgp.helpers.update(values,  ${columSetNameUpdate}) + ' ' + whereCondition + ' RETURNING ${makeSelectAll()}')

            ${makeGeometryReplaceString()}

            //@ts-ignore
            return ret
        }
    }

    /**
    @param idOrWhereCondition is either a single id or a where clause which shall be generated with pgp.as.format() e.g. pgp.as.format('WHERE id = \${id}', {id: 42})
    */
    export async function delete_${normalizeTableName(tableName)}<T extends number | string>(idOrWhereCondition: T): Promise<T extends number ? false | DBType_${dbTypeName} : DBType_${dbTypeName}[]>{
        if(typeof idOrWhereCondition === 'number'){
            const id = idOrWhereCondition as number
            const ret = await db.oneOrNone<DBType_${dbTypeName}>('DELETE FROM ${tableName} WHERE id = \${id} RETURNING ${makeSelectAll()}', {id})

            if(!ret){
                //@ts-ignore
                return false
            }

            ${makeGeometryReplaceString(true)}

            //@ts-ignore
            return ret

        } else {
            let whereCondition = idOrWhereCondition as string
            whereCondition = whereCondition.trim()
            if(whereCondition.endsWith(';')){
                whereCondition = whereCondition.substring(0, whereCondition.length - 1)
            }

            const ret = await db.manyOrNone<DBType_${dbTypeName}>('DELETE FROM ${tableName} ' + whereCondition + ' RETURNING ${makeSelectAll()}')

            ${makeGeometryReplaceString()}

            //@ts-ignore
            return ret
        }
    }`

    if(tableDefinition.columns.find(el => el.name === 'id')){

        exportString += `\n\n    /**
        @param idOrWhereCondition is either a single id or a where clause which shall be generated with pgp.as.format() e.g. pgp.as.format('WHERE id = \${id}', {id: 42})
        */
        export async function select_${normalizeTableName(tableName)}<T extends number | string>(idOrWhereCondition: T): Promise<T extends number ? false | DBType_${dbTypeName} : DBType_${dbTypeName}[]>{
            if(typeof idOrWhereCondition === 'number'){
                const id = idOrWhereCondition as number
                const ret = await db.oneOrNone<DBType_${dbTypeName}>('SELECT ${makeSelectAll()} FROM ${tableName} ' + pgp.as.format('WHERE id = \${id}', {id}))

                if(!ret){
                    //@ts-ignore
                    return false
                }

                ${makeGeometryReplaceString(true)}

                //@ts-ignore
                return ret
            } else {
                let whereCondition = idOrWhereCondition as string
                whereCondition = whereCondition.trim()
                if(whereCondition.endsWith(';')){
                    whereCondition = whereCondition.substring(0, whereCondition.length - 1)
                }

                const ret = await db.manyOrNone<DBType_${dbTypeName}>('SELECT ${makeSelectAll()} FROM ${tableName} ' + whereCondition)

                ${makeGeometryReplaceString()}

                //@ts-ignore
                return ret
            }

        }`


        }

        saveToFile(exportString, '../api/src/generated-definitions/db/DBHelpers.ts')

        console.log('  done helpers for (' + tables.length + ' tables exported)')
    }

    function normalizeTableName(tableName: string){
        let normed = camelcasify(tableName)
        if(normed.endsWith('s')){
            normed = normed.substring(0, normed.length - 1)
        }

        return normed;
    }
}
