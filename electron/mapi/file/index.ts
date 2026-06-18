import {BasicFileOps} from './basic'
import {HubOps} from './hub'
import {ExtraOps} from './extra'
import {textToName, pathToName, inDir, absolutePath, fullPath} from './utils'

export const FileIndex = {
    fullPath,
    absolutePath,
    ...BasicFileOps,
    ...HubOps,
    ...ExtraOps,
    textToName,
    pathToName,
    inDir,
}

export default FileIndex
