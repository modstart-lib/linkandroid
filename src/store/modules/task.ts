import {defineStore} from "pinia"
import store from "../index";
import {toRaw} from "vue";
import {cloneDeep} from "lodash-es";
import {StringUtil} from "../../lib/util";
import {mapError} from "../../lib/error";

export type TaskRecordStatus = 'queue' | 'running' | 'querying' | 'success' | 'fail' | 'delete'

export type TaskRecordRunStatus = 'retry' | 'success'

export type TaskRecordQueryStatus = 'running' | 'success' | 'fail'

export type TaskChangeType = 'running' | 'success' | 'fail'

export type TaskRecord = {
    id: string;
    status: TaskRecordStatus,
    msg: string;
    biz: string;
    bizId: string;
    bizParam: any;
    // 开始运行时间
    runStart: number;
    // 是否正在调用 runFunc
    runCalling: boolean;
    // 超过 runAfter 才会执行，0表示是一个新任务，＞0表示是一个重试任务
    runAfter: number;
    // 是否正在调用 queryFunc
    queryCalling: boolean;
    // 超过 queryAfter 才会查询
    queryAfter: number;
    // 查询间隔
    queryInterval: number;
    // 是否正在调用 successFunc
    successCalling: boolean;
    // 超时时间
    timeout: number;
}

export type TaskBiz = {
    runFunc: (bizId: string, bizParam: any) => Promise<TaskRecordRunStatus>,
    queryFunc?: (bizId: string, bizParam: any) => Promise<TaskRecordQueryStatus>,
    successFunc: (bizId: string, bizParam: any) => Promise<void>,
    // 请确保 failFunc 不会抛出异常
    failFunc: (bizId: string, msg: string, bizParam: any) => Promise<void>,
    restore?: () => Promise<void>,
}

const taskChangeListeners = [] as {
    biz: string,
    callback: (bizId: string, status: TaskChangeType) => void
}[]
let runNextTimer = null as any

export const taskStore = defineStore("task", {
    state() {
        return {
            bizMap: {} as Record<string, TaskBiz>,
            records: [] as TaskRecord[],
        }
    },
    actions: {
        async init() {
            await window.$mapi.storage.get("task", "records", [])
                .then((records) => {
                    this.records = records
                })
        },
        _runExecute() {
            let changed = false
            // error record
            this.records.forEach((record) => {
                if (!this.bizMap[record.biz]) {
                    record.status = 'fail'
                    record.msg = 'biz not found'
                    changed = true
                }
            })
            // console.log('task.records', JSON.stringify(this.records, null, 2))
            // queue
            this.records
                .filter(r => r.status === 'queue')
                .filter(r => r.runAfter <= Date.now() && !r.runCalling)
                .forEach((record) => {
                    changed = true
                    record.status = 'running'
                    record.runStart = Date.now()
                    record.runCalling = true
                    this.bizMap[record.biz]
                        .runFunc(record.bizId, record.bizParam)
                        .then((status: TaskRecordRunStatus) => {
                            if ('retry' === status) {
                                record.status = 'queue'
                                record.runStart = 0
                                record.runAfter = Date.now() + 1000
                            } else {
                                if (!!this.bizMap[record.biz].queryFunc) {
                                    record.queryAfter = Date.now() + record.queryInterval
                                    record.status = 'querying'
                                } else {
                                    record.status = 'success'
                                }
                            }
                        })
                        .catch((e) => {
                            record.status = 'fail'
                            record.msg = mapError(e)
                        })
                        .finally(() => {
                            record.runCalling = false
                            this.fireChange(record, 'running')
                        })
                })
            // querying
            this.records
                .filter(r => r.status === 'querying')
                .filter(r => r.queryAfter <= Date.now() && !r.queryCalling)
                .forEach((record) => {
                    record.queryCalling = true
                    const taskBiz = this.bizMap[record.biz]
                    taskBiz.queryFunc?.(record.bizId, record.bizParam)
                        .then((status) => {
                            switch (status) {
                                case 'running':
                                    record.queryAfter = Date.now() + record.queryInterval
                                    break
                                case 'success':
                                    record.status = 'success'
                                    changed = true
                                    break
                                case 'fail':
                                    record.status = 'fail'
                                    changed = true
                                    break
                            }
                        })
                        .catch((e) => {
                            record.status = 'fail'
                            record.msg = mapError(e)
                            changed = true
                        })
                        .finally(() => {
                            record.queryCalling = false
                        })
                })
            // expire
            this.records
                .filter(r => r.status === 'running' || r.status === 'querying')
                .filter(r => Date.now() - r.runStart > r.timeout)
                .forEach((record) => {
                    record.status = 'fail'
                    record.msg = mapError('ProcessTimeout')
                    changed = true
                })
            // success
            this.records
                .filter(r => r.status === 'success')
                .filter(r => !r.successCalling)
                .forEach((record) => {
                    record.successCalling = true
                    changed = true
                    this.bizMap[record.biz]
                        .successFunc(record.bizId, record.bizParam)
                        .then(() => {
                            record.status = 'delete'
                        })
                        .catch((e) => {
                            record.status = 'fail'
                            record.msg = mapError(e)
                        })
                        .finally(() => {
                            if (record.status === 'delete') {
                                this.fireChange(record, 'success')
                            }
                            record.successCalling = false
                        })
                })
            // fail
            this.records
                .filter(r => r.status === 'fail')
                .forEach((record) => {
                    changed = true
                    record.status = 'delete'
                    if (!this.bizMap[record.biz]) {
                        return
                    }
                    this.bizMap[record.biz]
                        .failFunc(record.bizId, record.msg, record.bizParam)
                        .then(() => {
                        })
                        .catch((e) => {
                        })
                        .finally(() => {
                            this.fireChange(record, 'fail')
                        })
                })
            // delete
            this.records = this.records.filter(r => r.status !== 'delete')
            // sync
            if (changed) {
                this.sync().then()
            }
            // next run
            // console.log('run', changed, JSON.stringify(this.records))
            if (this.records.length > 0) {
                this._run(changed)
            }
        },
        _run(immediate: boolean) {
            if (runNextTimer) {
                clearTimeout(runNextTimer)
                runNextTimer = null
            }
            setTimeout(() => {
                this._runExecute()
            }, immediate ? 0 : 1000)
        },
        register(biz: string, taskBiz: TaskBiz) {
            this.bizMap[biz] = taskBiz
        },
        unregister(biz: string) {
            delete this.bizMap[biz]
        },
        onChange(biz: string, callback: (bizId: string, type: TaskChangeType) => void) {
            taskChangeListeners.push({biz, callback})
        },
        offChange(biz: string, callback: (bizId: string, type: TaskChangeType) => void) {
            const index = taskChangeListeners.findIndex((v) => v.biz === biz && v.callback === callback)
            taskChangeListeners.splice(index, 1)
        },
        fireChange(record: TaskRecord, type: TaskChangeType) {
            taskChangeListeners.forEach((v) => {
                if (v.biz === record.biz) {
                    v.callback(record.bizId, type)
                }
            })
        },
        async dispatch(biz: string, bizId: string, bizParam?: any, param?: object) {
            if (!this.bizMap[biz]) {
                throw new Error('TaskBizNotFound')
            }
            param = Object.assign({
                timeout: 60 * 10 * 1000,
                queryInterval: 1 * 1000,
                status: 'queue',
                runStart: 0,
            }, param)
            const taskRecord = {
                id: `${biz}-${Date.now()}-${StringUtil.random(8)}`,
                status: param['status'],
                msg: '',
                biz,
                bizId,
                bizParam,
                runStart: param['runStart'],
                runAfter: 0,
                runCalling: false,
                queryAfter: 0,
                queryInterval: param['queryInterval'],
                queryCalling: false,
                successCalling: false,
                timeout: param['timeout'],
            } as TaskRecord
            this.records.push(taskRecord)
            this._run(true)
        },
        async sync() {
            const savedRecords = toRaw(cloneDeep(this.records))
            savedRecords.forEach((record) => {
                // record.status = undefined
                // record.runtime = undefined
            })
            await window.$mapi.storage.set("task", "records", savedRecords)
        },
    }
})

export const task = taskStore(store)
task.init().then(() => {
})

export const useTaskStore = () => {
    return task
}
