import {computed, ref, type Ref, type ComputedRef} from "vue";

export const ToggleUtil = {
    cachePool: new Map<string, { expire: number, value: Ref<boolean> }>(),
    gc() {
        const now = Date.now();
        for (const [key, {expire}] of this.cachePool) {
            if (expire < now) {
                this.cachePool.delete(key);
            }
        }
    },
    get(biz: string, bizId: any, defaultValue: boolean = false) {
        const key = `Toggle:${biz}:${bizId}`;
        if (!this.cachePool.has(key)) {
            const refValue = ref(defaultValue);
            this.cachePool.set(key, {expire: Date.now() + 3600 * 1000, value: refValue});
            return refValue;
        }
        const cached = this.cachePool.get(key)!;
        cached.expire = Date.now() + 3600 * 1000;
        ToggleUtil.gc();
        return cached.value;
    },

    toggle(biz: string, bizId: any) {
        const refValue = this.get(biz, bizId);
        refValue.value = !refValue.value;
        return refValue.value;
    }
};
