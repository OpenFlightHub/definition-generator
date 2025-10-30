import * as fs from 'fs'
import * as path from 'path'

/**
 * creates required directories if they dont exist
 */
export function saveToFile(text: string, filePath: string){

    const resolvedFilePath = path.resolve(filePath)
    const parentFolderPath = path.resolve(path.join(resolvedFilePath, '..'))

    if(!fs.existsSync(parentFolderPath)){
        fs.mkdirSync(parentFolderPath, {
            recursive: true
        })
    }

    fs.writeFileSync(filePath, text, {
        encoding: 'utf-8'
    })
}

export function readFile(filePath: string){
    const resolvedFilePath = path.resolve(filePath)

    if(!fs.existsSync(resolvedFilePath)){
        throw new Error('file does not exist: ' + resolvedFilePath)
    }

    return fs.readFileSync(resolvedFilePath, {encoding: 'utf-8'})
}