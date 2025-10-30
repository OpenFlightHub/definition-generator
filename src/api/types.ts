import {  OpenAPIV3_1 } from 'openapi-types'
import { saveToFile } from '../util/file'
import { JSONSchema } from 'json-schema-to-typescript'
import {convertJsonSchemaToTypescriptType} from '../util/json_schema_to_typescript'

export default async function generateApiTypes(openApiSchema: OpenAPIV3_1.Document){
    console.log('generate api types ...')

    let str = ''

    let exportedSchemasCount = 0

    if(openApiSchema.components && openApiSchema.components.schemas){
        for(const schemaName of Object.keys(openApiSchema.components.schemas)){
            const schema = openApiSchema.components.schemas[schemaName]

            let res = await convertJsonSchemaToTypescriptType(schema as JSONSchema, schemaName, 'ApiType_')

            str += res + '\n\n'

            exportedSchemasCount++
        }
    }

    saveToFile(str, '../api/src/definitions/ApiTypes.ts')

    console.log('  done (' + exportedSchemasCount + ' types exported)')
}
