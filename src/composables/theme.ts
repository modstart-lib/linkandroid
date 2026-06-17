import {computed, ref} from 'vue'

const isDark = ref(false)

// Watch for data-theme changes on document
const observer = new MutationObserver(() => {
    isDark.value = document.documentElement.getAttribute('data-theme') === 'dark'
})

observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
})

isDark.value = document.documentElement.getAttribute('data-theme') === 'dark'

export function useTheme() {
    return {
        isDark: computed(() => isDark.value),
    }
}
