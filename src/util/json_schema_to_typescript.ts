import { compile, JSONSchema } from "json-schema-to-typescript"
import { camelcasify, recursivelyWalkObject } from "./util"

export async function convertJsonSchemaToTypescriptType(schema: JSONSchema, schemaName: string, prefix: string){
    // by default prevent additionaProperties
    recursivelyPreventAdditional(schema)


    const schemaStates = schema.states
    if(schemaStates){
        delete schema.states
    }

    const name = prefix + camelcasify(schemaName)

    const type = await compile(schema, name, {
        bannerComment: '',
        style: {
            tabWidth: 4
        }
    })

    if(type.startsWith('export interface')){
        const indexOfFirstCurly = type.indexOf('{')

        if(indexOfFirstCurly === -1){
            return type
        } else {// force to export type and not interface, for nicer intellisense in vs code

            let typeString = '\nexport type ' + name + ' = ' + type.substring(indexOfFirstCurly)

            let preRes = ''

            if(schemaStates){

                for(const fieldName of Object.keys(schemaStates)){

                    const statesConstantName = name + '_' + fieldName.toUpperCase() + 'S'
                    const statesTypeName = name + '_' + camelcasify(fieldName) + 'Type'

                    preRes += 'export type ' + statesTypeName + ' = ' + schemaStates[fieldName].map(s => s.state).join('|') + '\n'
                    + 'export const ' + statesConstantName + ' = {\n  ' + schemaStates[fieldName].map(s => s.name + ': ' + s.state).join(',\n  ') + '\n} as const\n'

                    typeString = typeString.replaceAll(' ' + fieldName + ': number', ' ' + fieldName + ': ' + statesTypeName)
                }

            }


            typeString = typeString.replaceAll(': unknown', ': any')

            recursivelyWalkObject(schema, (entryWithoutType, key)=>{

                const entry = entryWithoutType as JSONSchema

                if(entry.type === 'array'){
                    if(typeof entry.maxLength === 'number' && entry.maxLength === entry.minLength){
                        //TODO this might be buggy if a different property with same name exists in this schema!

                        if((entry.items as JSONSchema).type === 'array'){
                            //TODO (looks like this is not necessary? lol)
                        } else {

                            const regex = new RegExp('^(\\s*' + key + '\\s*:\\s*).*$', 'gm')

                            typeString = typeString.replace(
                                regex,
                                (substring, ...args)=>{
                                    const ret = args[0] + ' [' + (new Array(entry.maxLength).fill((entry.items as JSONSchema).type)).join(', ') + '];'

                                    console.debug('replace', substring, ret)

                                    return ret
                                }
                            )
                        }
                    }
                }
            })

            return preRes + typeString
        }

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
