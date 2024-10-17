import {TaskBiz} from "../store/modules/task";

export const TestSync: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log('TestSync.runFunc', {bizId, bizParam})
        return 'success'
    },
    successFunc: async (bizId, bizParam) => {
        console.log('TestSync.successFunc', {bizId, bizParam})
    },
    failFunc: async (bizId, msg, bizParam) => {
        console.log('TestSync.failFunc', {bizId, bizParam, msg})
    }
}
