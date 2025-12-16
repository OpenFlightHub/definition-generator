

export function camelcasify(text: string, keepUnderscores = true){
    const lowerCase = text.toLowerCase()

    const words = lowerCase.replace(/[^a-zA-Z0-9]/g, '_').split('_').filter(t => t !== '')

    const ret = words.map((t, index) => {
        return t.substring(0, 1).toUpperCase() + t.substring(1)
    }).join(keepUnderscores ? '_' : '')

    if(ret === ''){
        throw new Error('camelcasify failed for "' + text + '"')
    }

    return ret
}


export function nonCircularObjectCloning(obj: Object){

    const knownObjects: any[] = []

    return JSON.parse(
        JSON.stringify(obj, (key, value)=>{
            if(key === 'database' || key === 'endpoints'){
                return null
            } else {
                for(let i = 0; i < knownObjects.length; i++){
                    if(knownObjects[i] == value){
                        return null
                    }
                }

                if(value instanceof Object){
                    knownObjects.push(value)
                }

                return value
            }
        })
    )
}

export function recursivelyWalkObject(obj: {[key: string]: any}, callback: (entry: {[key: string]: any}, key?: string) => void, key?: string){

    callback(obj, key)

    if(obj instanceof Array){
        for(const s of obj){
            recursivelyWalkObject(s, callback, key)
        }
    } else if(obj instanceof Object){
        for(const k of Object.keys(obj)){
            recursivelyWalkObject(obj[k], callback, key)
        }
    }
}
