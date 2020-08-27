import Vue from 'vue'
import VueRouter from 'vue-router'
import Home from '../views/Home.vue'

Vue.use(VueRouter)

const routes = [
    {
        path: '/',
        name: 'Home',
        component: Home
    },
    {
        path: '/local',
        name: '一个本地连接页面',
        // route level code-splitting
        component: () => import(/* webpackChunkName: "about" */ '../views/local.vue')
    },
    {
        path: '/remote',
        name: '远程连接视频',
        // route level code-splitting
        component: () => import(/* webpackChunkName: "about" */ '../views/remote.vue')
    },
    {
        path: '/some',
        name: '多人连接',
        // route level code-splitting
        component: () => import(/* webpackChunkName: "about" */ '../views/some.vue')
    },
]

const router = new VueRouter({
    mode: 'hash',
    base: process.env.BASE_URL,
    routes
})

export default router
