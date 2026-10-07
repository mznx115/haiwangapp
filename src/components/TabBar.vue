<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface TabItem {
  name: string
  label: string
  path: string
  icon: string
}

const tabs: TabItem[] = [
  {
    name: 'profiles',
    label: '对象',
    path: '/profiles',
    icon: 'M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5A8.5 8.5 0 1 1 21 11.5z',
  },
  {
    name: 'favorites',
    label: '话术库',
    path: '/favorites',
    icon: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.9l-5.3 2.7 1.1-5.8-4.3-4.1 5.9-.8z',
  },
  {
    name: 'me',
    label: '我',
    path: '/me',
    icon: 'M12 12.5a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5zM4 20.5c0-3.6 3.6-5.6 8-5.6s8 2 8 5.6',
  },
]

const route = useRoute()
const router = useRouter()

const active = computed(() => route.name as string)

function go(tab: TabItem) {
  if (route.name !== tab.name) void router.push(tab.path)
}
</script>

<template>
  <nav
    class="safe-bottom shrink-0 border-t border-wx-line bg-[#f7f7f7]/95 backdrop-blur-md"
  >
    <ul class="flex items-stretch">
      <li v-for="tab in tabs" :key="tab.name" class="flex-1">
        <button
          type="button"
          class="flex w-full flex-col items-center gap-0.5 pt-2 pb-1.5 transition-colors"
          :class="active === tab.name ? 'text-wx-brand' : 'text-[#7a7e83]'"
          @click="go(tab)"
        >
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.7"
            stroke-linecap="round" stroke-linejoin="round">
            <path :d="tab.icon" />
          </svg>
          <span class="text-[10px] leading-none">{{ tab.label }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>
