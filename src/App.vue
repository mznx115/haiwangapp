<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TabBar from '@/components/TabBar.vue'

const route = useRoute()
const showTab = computed(() => route.meta.tab === true)
</script>

<template>
  <div class="flex h-full flex-col bg-wx-bg">
    <main class="min-h-0 flex-1">
      <router-view />
    </main>
    <TabBar v-if="showTab" />
  </div>
</template>
