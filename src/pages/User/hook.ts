import {ref} from "vue";
import {useUserStore} from "../../store/modules/user";
import {useSettingStore} from "../../store/modules/setting";

const setting = useSettingStore()

export const useUserPage = ({web, status}) => {

    const webPreload = ref('')
    const webUrl = ref('')
    const webUserAgent = window.$mapi.app.getUserAgent()

    const user = useUserStore()
    const canGoBack = ref(false)

    const webUrlList = [
        '/app_manager/user',
        '/member_vip',
        '/login',
        '/register',
        '/logout'
    ]

    const getUrl = () => {
        const url = web.value.getURL()
        return new URL(url).pathname;
    }

    const getCanGoBack = () => {
        if (webUrlList[0] === getUrl()) {
            return false
        }
        return true
    }
    const doBack = async () => {
        web.value.loadURL(await user.webUrl())
    }

    const onMount = async () => {
        web.value.addEventListener('did-fail-load', (event: any) => {
            status.value?.setStatus('fail')
        });
        web.value.addEventListener('did-finish-load', (event: any) => {
            if (setting.shouldDarkMode()) {
                web.value.executeJavaScript(`document.body.setAttribute('data-theme', 'dark');`)
            }
        })
        web.value.addEventListener('dom-ready', (e) => {
            // web.value.openDevTools()
            window.$mapi.user.refresh()
            canGoBack.value = getCanGoBack()
            web.value.insertCSS(`.pb-page-member-vip .top{ padding-left: 5rem; }`)
            web.value.executeJavaScript(`
document.addEventListener('click', (event) => {
    const target = event.target;
    if (target.tagName !== 'A') return;
    const url = target.href
    if(url.startsWith('javascript:')) return;
    const urlPath = new URL(url).pathname;
    const whiteList = ${JSON.stringify(webUrlList)};
    if (whiteList.includes(urlPath)) return;
    event.preventDefault();
    window.$mapi.user.openWebUrl(url)
});
`)
            status.value?.setStatus('success')
        });
        status.value?.setStatus('loading')
        webPreload.value = await window.$mapi.app.getPreload()
        webUrl.value = await user.webUrl()
    }

    return {
        webPreload,
        webUrl,
        webUserAgent,
        user,
        canGoBack,
        doBack,
        onMount,
    }
}
