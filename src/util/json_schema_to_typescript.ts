import { compile, JSONSchema } from "json-schema-to-typescript"
import { camelcasify } from "./util"

export async function convertJsonSchemaToTypescriptType(schema: JSONSchema, schemaName: string, prefix: string){
    // by default prevent additionaProperties
    recursivelyPreventAdditional(schema)

    const name = prefix + camelcasify(schemaName)

    const type = await compile(schema, name, {
        bannerComment: '',
        style: {
            tabWidth: 4
        }
    })


    if(type.startsWith('export interface')){
        const indexOfFirstCurly = type.indexOf('{')

        // force to export type and not interface, for nicer intellisense in vs code
        return 'export type ' + name + ' = ' + type.substring(indexOfFirstCurly)
    } else {
        return type
    }
}

function recursivelyPreventAdditional(schema: JSONSchema){
    if(!schema.type || schema.type === 'object'){
        if(schema.additionalProperties === undefined){
            schema.additionalProperties = false
        }

        if(schema.properties){
            for(const prop of Object.keys(schema.properties)){
                recursivelyPreventAdditional(schema.properties[prop])
            }
        }
    } else if(schema.type === 'array'){
        if(schema.additionalItems === undefined){
            schema.additionalItems = false
        }

        if(schema.items){
            recursivelyPreventAdditional(schema.items)
        }
    }
}
