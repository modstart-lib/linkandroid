/**
 * 兼容旧引用路径：共享逻辑位于 src/lib/updater.ts，
 * 渲染进程与主进程可以复用同一份类型和纯函数。
 */
export * from '../../../src/lib/updater'
export {default} from '../../../src/lib/updater'
