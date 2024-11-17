type DomListener = {
    dom: HTMLElement
    callback: (width: number, height: number) => void
}
let domListeners: DomListener[] = []
const resizeObserver = new ResizeObserver((entries) => {
    entries.forEach(entry => {
        domListeners.forEach(item => {
            if (item.dom === entry.target) {
                const {width, height} = entry.contentRect
                item.callback(width, height)
            }
        })
    })
})

type WindowListener = {
    callback: (width: number, height: number) => void
}
let windowListeners: WindowListener[] = []
window.addEventListener('resize', () => {
    windowListeners.forEach(item => {
        item.callback(window.innerWidth, window.innerHeight)
    })
})

export const UI = {
    onWindowResize(callback: (width: number, height: number) => void) {
        windowListeners.push({callback})
    },
    offWindowResize(callback: (width: number, height: number) => void) {
        windowListeners = windowListeners.filter(item => item.callback !== callback)
    },
    onResize(dom: HTMLElement | null, callback: (width: number, height: number) => void) {
        if (!dom) return
        domListeners.push({dom, callback})
        resizeObserver.observe(dom)
    },
    offResize(dom: HTMLElement | null) {
        if (!dom) return
        domListeners = domListeners.filter(item => item.dom !== dom)
        resizeObserver.unobserve(dom)
    },
    fireResize(dom: HTMLElement) {
        domListeners.forEach(item => {
            if (item.dom === dom) {
                const {width, height} = dom.getBoundingClientRect()
                item.callback(width, height)
            }
        })
    }
}


export class TabContentScroller {
    private option: {
        activeClass: string
    }
    private tabContainer: HTMLElement
    private contentContainer: HTMLElement
    private isScrolling = false
    private scrollEndTimer: any | null = null
    private scrollEndCallback: (() => void) | null = null

    constructor(tabContainer: HTMLElement, contentContainer: HTMLElement, option: {} = {}) {
        this.option = Object.assign({
            activeClass: 'active',
        }, option) || {}
        this.tabContainer = tabContainer
        this.contentContainer = contentContainer
        this.init()
    }


    init() {
        this.tabContainer.addEventListener('click', this.onTabClickEvent.bind(this))
        this.contentContainer.addEventListener('scroll', this.onContentScrollEvent.bind(this))
    }

    destroy() {
        this.tabContainer.removeEventListener('click', this.onTabClickEvent.bind(this))
        this.contentContainer.removeEventListener('scroll', this.onContentScrollEvent.bind(this))
    }

    onTabClickEvent(e: MouseEvent) {
        const parentSection = (e.target as HTMLElement).closest('[data-section]')
        const name = parentSection?.getAttribute('data-section')
        if (name) {
            this.scrollTo(name)
            this.scrollEndCallback = () => {
                this.forceActiveTab(name)
            }
        }
    }

    onContentScrollEvent(e: Event) {
        this.isScrolling = true
        if (this.scrollEndTimer) {
            clearTimeout(this.scrollEndTimer)
        }
        this.scrollEndTimer = setTimeout(() => {
            this.isScrolling = false
            this.scrollEndTimer = null
            if (this.scrollEndCallback) {
                this.scrollEndCallback()
                this.scrollEndCallback = null
            }
        }, 100)
        const tabs = this.tabContainer.querySelectorAll('[data-section]')
        for (let i = 0; i < tabs.length; i++) {
            const tab = tabs[i]
            tab.classList.remove(this.option.activeClass)
        }
        const sections = this.contentContainer.querySelectorAll('[data-section]')
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i]
            const rect = section.getBoundingClientRect()
            if (rect.top < 100 && rect.bottom > 100) {
                const name = section.getAttribute('data-section') || ''
                const tab = this.tabContainer.querySelector(`[data-section="${name}"]`)
                if (tab) {
                    tab.classList.add(this.option.activeClass)
                }
                break
            }
        }
    }

    forceActiveTab(name: string) {
        const tabs = this.tabContainer.querySelectorAll('[data-section]')
        for (let i = 0; i < tabs.length; i++) {
            const tab = tabs[i]
            const tabName = tab.getAttribute('data-section') || ''
            if (tabName === name) {
                tab.classList.add(this.option.activeClass)
            } else {
                tab.classList.remove(this.option.activeClass)
            }
        }
    }

    scrollTo(name: string) {
        const tab = this.tabContainer.querySelector(`[data-section="${name}"]`)
        if (!tab) {
            return
        }
        const content = this.contentContainer.querySelector(`[data-section="${name}"]`)
        if (!content) {
            return
        }
        content.scrollIntoView({
            behavior: 'smooth'
        })
    }
}
