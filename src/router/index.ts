import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

/**
 * 使用 hash 路由：Capacitor 打包后由本地静态服务器托管，
 * hash 路由无需服务端 SPA fallback，刷新/深链都不会 404。
 */
const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/profiles' },
  {
    path: '/profiles',
    name: 'profiles',
    component: () => import('@/views/ProfilesView.vue'),
    meta: { tab: true, title: '对象' },
  },
  {
    path: '/profile/new',
    name: 'profile-new',
    component: () => import('@/views/ProfileEditView.vue'),
    meta: { tab: false, title: '添加对象' },
  },
  {
    path: '/profile/:id/edit',
    name: 'profile-edit',
    component: () => import('@/views/ProfileEditView.vue'),
    meta: { tab: false, title: '编辑档案' },
  },
  {
    path: '/chat/:profileId',
    name: 'chat',
    component: () => import('@/views/ChatView.vue'),
    meta: { tab: false, title: '会话' },
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: () => import('@/views/FavoritesView.vue'),
    meta: { tab: true, title: '话术库' },
  },
  {
    path: '/me',
    name: 'me',
    component: () => import('@/views/MeView.vue'),
    meta: { tab: true, title: '我' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { tab: false, title: '设置' },
  },
  {
    path: '/skill',
    name: 'skill',
    component: () => import('@/views/SkillView.vue'),
    meta: { tab: false, title: '技能包' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { tab: false, title: '未找到' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? '海王'
  document.title = title === '海王' ? '海王' : `${title} · 海王`
})

export default router
