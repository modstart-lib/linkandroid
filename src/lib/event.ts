import {EventType} from "../types/Event.js";
import {TinyEmitter} from "tiny-emitter";

const emitter = new TinyEmitter();

export const GlobalEvent = {
    on: function (event: EventType, callback: Function) {
        emitter.on(event, callback);
    },
    once: function (event: EventType, callback: Function) {
        emitter.once(event, callback);
    },
    off: function (event: EventType, callback: Function) {
        emitter.off(event, callback);
    },
    emit: function (event: EventType, ...args: any[]) {
        emitter.emit(event, ...args);
    },
};
