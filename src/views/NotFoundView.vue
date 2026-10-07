<script setup lang="ts">
import { useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'

const router = useRouter()
</script>

<template>
  <div class="flex h-full flex-col">
    <NavBar title="页面不存在" />
    <div class="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <p class="text-[14px] text-wx-sub">没有找到这个页面。</p>
      <button
        type="button"
        class="rounded-md bg-wx-brand px-4 py-2 text-[14px] text-white active:opacity-80"
        @click="router.replace('/profiles')"
      >
        回到首页
      </button>
    </div>
  </div>
</template>
