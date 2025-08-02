import {useTaskStore} from "../store/modules/task";
import {StringUtil} from "../lib/util";
import {TestAsync} from "./TestAsync";
import {TestSync} from "./TestSync";

const taskStore = useTaskStore();

export const TaskManager = {
    init() {
        // taskStore.register('TestSync', TestSync)
        // taskStore.register('TestAsync', TestAsync)
        // setInterval(async () => {
        //     // await taskStore.dispatch('TestSync', StringUtil.random())
        //     await taskStore.dispatch('TestAsync', StringUtil.random(), {
        //         'a': 1,
        //     }, {
        //         timeout: 3 * 1000,
        //     })
        // }, 10 * 1000)
    },
    count() {
        return taskStore.records.length;
    },
};
