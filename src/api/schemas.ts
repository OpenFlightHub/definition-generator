import {  OpenAPIV3_1 } from 'openapi-types'
import { camelcasify } from '../util/util'
import { saveToFile } from '../util/file'

export default function generateApiSchemas(openApiSchema: OpenAPIV3_1.Document){
    console.log('generate api schemas ...')

    let str = 'import {JSONSchema4} from \'../util/types/JSONSchema\'\n\n'

    let exportedSchemasCount = 0

    if(openApiSchema.components && openApiSchema.components.schemas){

        for(const schemaName of Object.keys(openApiSchema.components.schemas)){
            const schema = openApiSchema.components.schemas[schemaName]

            //@ts-ignore
            delete schema['x-internal'] // remove internal marker

            str += `export const ${'ApiSchema_' + camelcasify(schemaName) + ' : JSONSchema4 '} = ` + JSON.stringify(schema, null, 4) + '\n\n'

            exportedSchemasCount++
        }
    }


    saveToFile(str, '../api/src/generated-definitions/api/ApiSchemas.ts')

    console.log('  done (' + exportedSchemasCount + ' schemas exported)')
}