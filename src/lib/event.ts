import {TinyEmitter} from "tiny-emitter";

const emitter = new TinyEmitter();

export const GlobalEvent = {
    on: function (event: string, callback: Function) {
        emitter.on(event, callback);
    },
    once: function (event: string, callback: Function) {
        emitter.once(event, callback);
    },
    off: function (event: string, callback: Function) {
        emitter.off(event, callback);
    },
    emit: function (event: string, ...args: any[]) {
        emitter.emit(event, ...args);
    },
};
