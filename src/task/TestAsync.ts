import {TaskBiz} from "../store/modules/task";

export const TestAsync: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log('TestAsync.runFunc', {bizId, bizParam})
        return 'success'
    },
    queryFunc(bizId, bizParam) {
        return new Promise((resolve) => {
            console.log('TestAsync.queryFunc', {bizId, bizParam})
            setTimeout(() => {
                resolve(Math.random() > 0.7 ? 'success' : 'running')
            }, 1000)
        })
    },
    successFunc: async (bizId, bizParam) => {
        console.log('TestAsync.successFunc', {bizId, bizParam})
    },
    failFunc: async (bizId, msg, bizParam) => {
        console.log('TestAsync.failFunc', {bizId, bizParam, msg})
    }
}
