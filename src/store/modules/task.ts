import {defineStore} from "pinia"
import store from "../index";
import {toRaw} from "vue";
import {cloneDeep} from "lodash-es";
import {StringUtil} from "../../lib/util";

export type TaskRecordStatus = 'queue' | 'running' | 'querying' | 'success' | 'fail' | 'delete'

export type TaskRecordQueryStatus = 'unknown' | 'running' | 'success' | 'fail'

export type TaskRecord = {
    id: string;
    status: TaskRecordStatus,
    msg: string;
    biz: string;
    bizId: string;
    bizParam: any;
    runStart: number;
    timeout: number;
}

export type TaskBiz = {
    runFunc: (bizId: string, bizParam: any) => Promise<void>,
    queryFunc?: (bizId: string, bizParam: any) => Promise<TaskRecordQueryStatus>,
    successFunc: (bizId: string, bizParam: any) => Promise<void>,
    failFunc: (bizId: string, msg: string, bizParam: any) => Promise<void>,
}

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
            for (const record of this.records) {
                if (!this.bizMap[record.biz]) {
                    record.status = 'fail'
                    record.msg = 'biz not found'
                    changed = true
                }
            }
            // queue
            for (const record of this.records) {
                if (record.status !== 'queue') {
                    continue
                }
                changed = true
                record.status = 'running'
                record.runStart = Date.now()
                this.bizMap[record.biz]
                    .runFunc(record.bizId, record.bizParam)
                    .then(() => {
                        if (this.bizMap[record.biz].queryFunc) {
                            record.status = 'querying'
                        } else {
                            record.status = 'success'
                        }
                    })
                    .catch((e) => {
                        record.status = 'fail'
                        record.msg = e.message
                    })
            }
            // querying
            for (const record of this.records) {
                if (record.status !== 'querying' && record.status !== 'running') {
                    continue
                }
                const taskBiz = this.bizMap[record.biz]
                taskBiz.queryFunc?.(record.bizId, record.bizParam)
                    .then((status) => {
                        switch (status) {
                            case 'unknown':
                            case 'running':
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
                        record.msg = e.message
                        changed = true
                    })
            }
            // expire
            for (const record of this.records) {
                if (record.status !== 'running' && record.status !== 'querying') {
                    continue
                }
                if (Date.now() - record.runStart > record.timeout) {
                    record.status = 'fail'
                    record.msg = 'timeout'
                    changed = true
                }
            }
            // success
            for (const record of this.records) {
                if (record.status !== 'success') {
                    continue
                }
                changed = true
                record.status = 'delete'
                this.bizMap[record.biz]
                    .successFunc(record.bizId, record.bizParam)
                    .then(() => {
                    })
                    .catch((e) => {
                    })
            }
            // fail
            for (const record of this.records) {
                if (record.status !== 'fail') {
                    continue
                }
                changed = true
                record.status = 'delete'
                this.bizMap[record.biz]
                    .failFunc(record.bizId, record.msg, record.bizParam)
                    .then(() => {
                    })
                    .catch((e) => {
                    })
            }
            // delete
            this.records = this.records.filter(r => r.status !== 'delete')
            // sync
            if (changed) {
                this.sync().then()
            }
            // next run
            console.log('run', changed, JSON.stringify(this.records))
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
        async dispatch(biz: string, bizId: string, bizParam?: any, param?: object) {
            if (!this.bizMap[biz]) {
                throw new Error('TaskBizNotFound')
            }
            param = Object.assign({
                timeout: 60 * 1000,
            }, param)
            const taskRecord = {
                id: `${biz}-${Date.now()}-${StringUtil.random(8)}`,
                status: 'queue' as TaskRecordStatus,
                msg: '',
                biz,
                bizId,
                bizParam,
                runStart: 0,
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
