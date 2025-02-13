const init = () => {
    // initLoaders()
}

const initLoaders = () => {
    function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
        return new Promise((resolve) => {
            if (condition.includes(document.readyState)) {
                resolve(true)
            } else {
                document.addEventListener('readystatechange', () => {
                    if (condition.includes(document.readyState)) {
                        resolve(true)
                    }
                })
            }
        })
    }

    const safeDOM = {
        append(parent: HTMLElement, child: HTMLElement) {
            if (!Array.from(parent.children).find(e => e === child)) {
                return parent.appendChild(child)
            }
        },
        remove(parent: HTMLElement, child: HTMLElement) {
            if (Array.from(parent.children).find(e => e === child)) {
                return parent.removeChild(child)
            }
        },
    }

    /**
     * https://tobiasahlin.com/spinkit
     * https://connoratherton.com/loaders
     * https://projects.lukehaas.me/css-loaders
     * https://matejkustec.github.io/SpinThatShit
     */
    function useLoading() {
        const className = `loaders-css__square-spin`
        const styleContent = `
@keyframes loading-spin {
    33%{background-size:calc(100%/3) 0%  ,calc(100%/3) 100%,calc(100%/3) 100%}
    50%{background-size:calc(100%/3) 100%,calc(100%/3) 0%  ,calc(100%/3) 100%}
    66%{background-size:calc(100%/3) 100%,calc(100%/3) 100%,calc(100%/3) 0%  }
}
.${className} > div {
  width: 60px;
  aspect-ratio: 4;
  --_g: no-repeat radial-gradient(circle closest-side,#cbd5e1 90%,#cbd5e100);
  background:
    var(--_g) 0%   50%,
    var(--_g) 50%  50%,
    var(--_g) 100% 50%;
  background-size: calc(100%/3) 100%;
  animation: loading-spin 1s infinite linear;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FFFFFF;
  z-index: 10000;
}
[data-theme="dark"] .app-loading-wrap {
    background: #17171A;
}
[data-theme="dark"] .${className} > div {
    --_g: no-repeat radial-gradient(circle closest-side,#2D3748 90%,#2D374800);
}
    `
        const oStyle = document.createElement('style')
        const oDiv = document.createElement('div')
        let hasLoading = false
        let setLoadingTimer = null

        oStyle.id = 'app-loading-style'
        oStyle.innerHTML = styleContent
        oDiv.className = 'app-loading-wrap'
        oDiv.innerHTML = `<div class="${className}"><div></div></div>`

        return {
            appendLoading() {
                setLoadingTimer = setTimeout(() => {
                    safeDOM.append(document.head, oStyle)
                    safeDOM.append(document.body, oDiv)
                    hasLoading = true
                }, 1000)
            },
            removeLoading() {
                clearTimeout(setLoadingTimer)
                if (hasLoading) {
                    safeDOM.remove(document.head, oStyle)
                    safeDOM.remove(document.body, oDiv)
                    hasLoading = false
                }
            },
        }
    }

    const {appendLoading, removeLoading} = useLoading()

    const isMain = () => {
        return true;
        let l = window.location.href
        if (l.indexOf('app.asar/dist/index.html') > 0) {
            return true
        }
        if (l.indexOf('localhost') > 0 && l.indexOf('.html') === -1) {
            return true
        }
        return false
    }

    if (isMain()) {
        domReady().then(appendLoading)
        window.onmessage = (ev) => {
            ev.data.payload === 'removeLoading' && removeLoading()
        }
    }

    setTimeout(removeLoading, 4999)
}


export default {
    init
}
