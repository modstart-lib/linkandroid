import {createRouter, createWebHashHistory} from 'vue-router'

const routes = [
    {
        path: '/',
        component: () => import('./layouts/Main.vue'),
        children: [
            {path: '', component: () => import('./pages/Home.vue')},
            {path: 'home', component: () => import('./pages/Home.vue')},
            {path: 'device', component: () => import('./pages/Device.vue')},
            {path: 'script', component: () => import('./pages/Script.vue')},
            {path: 'lib', component: () => import('./pages/Lib.vue')},
            {path: 'setting', component: () => import('./pages/Setting.vue')},
        ],
    },
    {
        path: '/',
        component: () => import('./layouts/Raw.vue'),
        children: [],
    },
    // 404 兜底：匹配所有未定义路径，渲染 NotFound 页面并在测试模式下输出 console.error
    {
        path: '/:pathMatch(.*)*',
        component: () => import('./pages/NotFound.vue'),
    },
]

const router = createRouter({
    history: createWebHashHistory(),
    routes,
})

// watch router change
router.beforeEach((to, from, next) => {
    window.$mapi?.statistics?.tick('visit', {
        path: to.path,
    })
    next()
})

export default router
