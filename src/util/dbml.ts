export function convertDBMLTypeToJSONSchemaType(type: string){
    switch(type){
        case 'text': return 'string'

        case 'integer':
        case 'serial': return 'integer'

        case 'decimal':
        case 'numeric':
        case 'float':
        case 'number':
        case 'float8':
        case 'double': return 'number'

        case 'timestamp':
        case 'timestamptz':
        case 'timetz':
        case 'time': return 'string'

        case 'boolean': return 'boolean'

        case 'uuid': return 'string'

        case 'jsonb': return 'Record<string,any>'

        default: throw new Error('unsupported DBML type: ' + type)

    }
}


export function convertDBMLTypeToTypescriptType(type: string){
    switch(type){
        case 'text': return 'string'

        case 'integer':
        case 'serial':
        case 'decimal':
        case 'numeric':
        case 'float':
        case 'number':
        case 'float8':
        case 'double': return 'number'

        case 'timestamp':
        case 'timestamptz':
        case 'timetz':
        case 'time': return 'string'

        case 'boolean': return 'boolean'

        case 'uuid': return 'string'

        case 'jsonb': return 'string'

        default: throw new Error('unsupported DBML type: ' + type)

    }
}


export function noteIsValidStateDefinition(note?: string){
    return parseNoteStateDefinition(note) !== false
}


export type States = {name: string, state: any}[]

export function parseNoteStateDefinition(note?: string){
    if(typeof note !== 'string' || note.length === 0){
        return false
    }

    const validSyntaxSubType = note.match(/^((\s*\w+:\s*)(\s*(\d+)\s*\=\s*([^,]+),){0,}(\s*(\d+)\s*\=\s*([^,]+)))(\s*;(\s*\w+:\s*)(\s*(\d+)\s*\=\s*([^,]+),){0,}(\s*(\d+)\s*\=\s*([^,]+))){1,}$/)

    if(validSyntaxSubType){
        const types = note.split(';')

        const allStates: States = []

        for(const type of types){
            const spl = type.split(':')
            const typeName = spl[0].trim()

            const subTypeStates = parseNoteStateDefinition(spl[1].trim())

            if(subTypeStates){
                for(const subType of subTypeStates){
                    allStates.push({
                        name: typeName + '_' + subType.name,
                        state: subType.state
                    })
                }
            }
        }

        return allStates
    }


    const validSyntaxType = note.match(/^(\s*(\d+)\s*\=\s*([^,]+),){0,}(\s*(\d+)\s*\=\s*([^,]+))$/)

    if(validSyntaxType){

        const parts = note.split(',')

        const states: States = []
        for(const p of parts){
            const match = p.match(/\s*(\d+)\s*\=\s*(.+)/)

            if(!match){
                throw new Error('invalid note syntax: ' + note)
            }

            const state = parseInt(match[1])
            let name = match[2].replaceAll(/[^a-zA-Z0-9]/g, '_').replaceAll(/_+/g, '_')
            if(name.endsWith('_')){
                name = name.substring(0, name.length - 1)
            }

            states.push({
                name,
                state
            })
        }

        return states
    }


    try {
        const parsed = JSON.parse(note)

        //TODO implement
        return false

    } catch (err){
        //continue
    }


    return false
}
