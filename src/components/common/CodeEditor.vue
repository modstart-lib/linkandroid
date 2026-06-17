<script setup lang="ts">
import {useTheme} from '../../composables/theme'
import {javascript} from '@codemirror/lang-javascript'
import {json} from '@codemirror/lang-json'
import {markdown} from '@codemirror/lang-markdown'
import {python} from '@codemirror/lang-python'
import {yaml} from '@codemirror/lang-yaml'
import {StreamLanguage} from '@codemirror/language'
import {shell} from '@codemirror/legacy-modes/mode/shell'
import {Compartment, EditorState, Extension} from '@codemirror/state'
import {oneDark} from '@codemirror/theme-one-dark'
import {EditorView} from '@codemirror/view'
import {basicSetup} from 'codemirror'
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue'

type Language = 'javascript' | 'typescript' | 'json' | 'yaml' | 'markdown' | 'text' | 'shell' | 'python'

const props = withDefaults(
    defineProps<{
        modelValue?: string
        placeholder?: string
        height?: string
        language?: Language
        autoHeight?: boolean
    }>(),
    {
        modelValue: '',
        placeholder: undefined,
        height: '300px',
        language: 'text',
        autoHeight: false,
    },
)

const {isDark} = useTheme()
const effectiveTheme = computed(() => (isDark.value ? 'dark' : 'light'))
const effectiveHeight = computed(() => (props.autoHeight ? 'auto' : props.height))

const emit = defineEmits<{
    'update:modelValue': [value: string]
}>()

const editorContainer = ref<HTMLDivElement>()
let view: EditorView | null = null
const themeCompartment = new Compartment()
const languageCompartment = new Compartment()

function getLanguageExtension(lang: Language): Extension {
    switch (lang) {
        case 'javascript':
        case 'typescript':
            return javascript({typescript: lang === 'typescript'})
        case 'json':
            return json()
        case 'yaml':
            return yaml()
        case 'markdown':
            return markdown()
        case 'shell':
            return StreamLanguage.define(shell)
        case 'python':
            return python()
        default:
            return []
    }
}

const getThemeExtension = () => {
    const dark = effectiveTheme.value === 'dark'
    const contentMinHeight = props.autoHeight ? '60px' : null
    return [
        ...(dark ? [oneDark] : []),
        EditorView.theme(
            {
                '&': {
                    height: effectiveHeight.value,
                },
                '.cm-content, .cm-gutter': {
                    ...(contentMinHeight ? {minHeight: contentMinHeight} : {}),
                },
                '.cm-scroller': {
                    overflow: 'auto',
                    fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                    fontSize: '13px',
                },
                ...(dark
                    ? {
                          '&': {
                              backgroundColor: '#282c34',
                          },
                          '.cm-gutters': {
                              backgroundColor: '#282c34',
                              color: '#636d83',
                              border: 'none',
                          },
                          '.cm-activeLineGutter': {backgroundColor: '#2c313a'},
                      }
                    : {}),
            },
            {dark},
        ),
    ]
}

const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
        emit('update:modelValue', update.state.doc.toString())
    }
})

onMounted(() => {
    const state = EditorState.create({
        doc: props.modelValue ?? '',
        extensions: [
            basicSetup,
            languageCompartment.of(getLanguageExtension(props.language)),
            themeCompartment.of(getThemeExtension()),
            updateListener,
        ],
    })

    view = new EditorView({
        state,
        parent: editorContainer.value!,
    })
})

watch(
    () => props.language,
    (lang) => {
        if (!view) return
        view.dispatch({
            effects: languageCompartment.reconfigure(getLanguageExtension(lang)),
        })
    },
)

watch(effectiveTheme, () => {
    if (!view) return
    view.dispatch({
        effects: themeCompartment.reconfigure(getThemeExtension()),
    })
})

watch(
    () => props.modelValue,
    (val) => {
        if (!view) return
        const current = view.state.doc.toString()
        if (val !== current) {
            view.dispatch({
                changes: {from: 0, to: current.length, insert: val ?? ''},
            })
        }
    },
)

onBeforeUnmount(() => {
    view?.destroy()
})
</script>

<template>
    <div class="code-editor-wrapper" :class="effectiveTheme === 'dark' ? 'theme-dark' : 'theme-light'">
        <div ref="editorContainer" class="code-editor-container" />
    </div>
</template>

<style scoped>
.code-editor-wrapper {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--color-glass-border);
    box-shadow:
        0 4px 6px -1px rgba(0, 0, 0, 0.05),
        0 2px 4px -1px rgba(0, 0, 0, 0.03);
    transition: all 0.3s ease;
}

.code-editor-container {
    flex: 1;
    min-height: 0;
}

.code-editor-wrapper.theme-light {
    background: var(--color-glass);
    backdrop-filter: blur(12px);
}
.code-editor-wrapper.theme-light:hover {
    border-color: var(--token-primary);
    box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.08);
}
.code-editor-wrapper.theme-light:focus-within {
    border-color: var(--token-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--token-primary) 15%, transparent);
}

.code-editor-wrapper.theme-dark {
    background: var(--color-glass);
    backdrop-filter: blur(12px);
    border-color: var(--color-glass-border);
}
.code-editor-wrapper.theme-dark:hover {
    border-color: var(--token-primary);
    box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.2);
}
.code-editor-wrapper.theme-dark:focus-within {
    border-color: var(--token-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--token-primary) 20%, transparent);
}

.code-editor-container :deep(.cm-editor) {
    height: v-bind(effectiveHeight);
    background: transparent !important;
}

.code-editor-container :deep(.cm-editor.cm-focused) {
    outline: none;
}
</style>
