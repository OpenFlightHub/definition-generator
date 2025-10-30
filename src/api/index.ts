import OpenApiParser from'@readme/openapi-parser'
import generateApiSchemas from './schemas'
import generateApiTypes from './types'
import {  OpenAPIV3_1 } from 'openapi-types'
import { recursivelyWalkObject } from '../util/util'

export async function generateApiTypesAndSchemas(){

    const openApiSchema = await loadOpenApiSchema('../api/openapi_spec.yaml')

    generateApiSchemas(openApiSchema)

    await generateApiTypes(openApiSchema)
}




async function loadOpenApiSchema(filePath: string){

    const doc = await OpenApiParser.dereference(filePath)

    // delete all x- node properties
    recursivelyWalkObject(doc, entry => {
        if(entry instanceof Object && entry instanceof Array === false){
            for(const key of Object.keys(entry)){
                if(key.startsWith('x-')){
                    delete entry[key]
                }
            }
        }
    })

    // combine allOf schemas (otherwise it leads to bugs with ajv)
    recursivelyWalkObject(doc, entry => {
        if(entry instanceof Object && entry instanceof Array === false){
            if(entry['allOf']){

                const combinedType: {[key: string]: any} = {}

                for(const subSchema of entry['allOf']){
                    for(const jsonSchemaKey of Object.keys(subSchema)){
                        if(jsonSchemaKey === 'required'){
                            if(typeof combinedType['required'] === 'undefined'){
                                combinedType['required'] = []
                            }

                            for(const requiredEntry of subSchema[jsonSchemaKey]){
                                if(combinedType['required'].includes(requiredEntry) === false){
                                    combinedType['required'].push(requiredEntry)
                                }
                            }
                        } else if (jsonSchemaKey === 'properties'){
                            if(typeof combinedType['properties'] === 'undefined'){
                                combinedType['properties'] = {}
                            }

                            for(const propertyName of Object.keys(subSchema[jsonSchemaKey])){
                                if(combinedType['properties'][propertyName]){
                                    Object.assign(combinedType['properties'][propertyName], subSchema[jsonSchemaKey][propertyName])
                                } else {
                                    combinedType['properties'][propertyName] = subSchema[jsonSchemaKey][propertyName]
                                }

                            }
                        } else if(typeof combinedType[jsonSchemaKey] === 'undefined'){
                            combinedType[jsonSchemaKey] = subSchema[jsonSchemaKey]
                        }
                    }
                }

                delete entry['allOf']

                Object.assign(entry, combinedType)
            }
        }
    })


    return doc as OpenAPIV3_1.Document
}
