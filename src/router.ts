import {createRouter, createWebHashHistory} from 'vue-router'


const routes = [
    {
        path: '/',
        component: () => import('./layouts/Main.vue'),
        children: [
            {path: '', component: () => import('./pages/Login.vue')},
            {path: 'home', component: () => import('./pages/Home.vue')},
            {path: 'device', component: () => import('./pages/Device.vue')},
            {path: 'setting', component: () => import('./pages/Setting.vue')},
            {path: 'about', component: () => import('./pages/About.vue')},
            {path: 'account', component: () => import('./pages/Account.vue')},
        ]
    },
    {
        path: '/',
        component: () => import('./layouts/Raw.vue'),
        children: [
            {path: 'login', component: () => import('./pages/Login.vue')},
        ]
    },
]

const router = createRouter({
    history: createWebHashHistory(),
    routes
})

// watch router change
router.beforeEach((to, from, next) => {
    window.$mapi?.statistics?.tick('visit', {
        path: to.path
    })
    next()
})

export default router
