import Table from "@dbml/core/types/model_structure/table"
import { convertJsonSchemaToTypescriptType } from "../util/json_schema_to_typescript"
import { convertDBMLTypeToJSONSchemaType, parseNoteStateDefinition, States } from "../util/dbml"
import { saveToFile } from "../util/file"
import { JSONSchema } from "json-schema-to-typescript"

export default async function generateDatabaseTypes(tables: Table[], dbmlString: string){
    console.log('generate DB Types ...')

    let exportString = ''

    for(const table of tables){
        if(table){
            let name = table.name

            if(name === ''){
                console.error(table)
                throw new Error('table.name is invalid: ' + name)
            }

            if(name.endsWith('s')){
                name = name.substring(0, name.length - 1)
            }

            const schema: {
                required: string[]
                properties: {[key: string]: {
                    type: string,
                    description: string
                }}
                states?: {[key: string]: States}
            } = {
                required: [],
                properties: {}
            }

            for(const field of table.fields){

                let comment

                const fieldString = dbmlString.substring(field.token.start.offset, field.token.end.offset)
                if(fieldString.indexOf('//') !== -1){
                    comment = fieldString.substring(fieldString.indexOf('//') + 2).trim()
                }

                const noteStateDefinition = parseNoteStateDefinition(field.note)
                if(noteStateDefinition !== false){
                    if(!schema.states){
                        schema.states = {}
                    }
                    schema.states[field.name] = noteStateDefinition
                }

                try {
                    schema.properties[field.name] = {
                        type: convertDBMLTypeToJSONSchemaType(field.type.type_name),
                        description: comment || field.note || ''
                    }

                    if(field.not_null){
                        schema.required.push(field.name)
                    }
                } catch (err){
                    console.error('@ table', table.name, 'field', field.name, field)
                    throw err
                }
            }

            exportString += (await convertJsonSchemaToTypescriptType(schema as JSONSchema, name, 'DBType_')) + '\n\n'
        }
    }

    saveToFile(exportString, '../api/src/generated-definitions/db/DBTypes.ts')

    console.log('  done (' + tables.length + ' types exported)')
}
