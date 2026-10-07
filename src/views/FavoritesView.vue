<script setup lang="ts">
import NavBar from '@/components/NavBar.vue'
</script>

<template>
  <div class="flex h-full flex-col">
    <NavBar title="话术库" :back="false" />
    <div class="scroll-area min-h-0 flex-1 px-4 py-6">
      <div class="rounded-lg bg-wx-other p-4 text-[13px] leading-relaxed text-wx-sub">
        <p class="mb-2 text-[14px] font-medium text-wx-text">收藏夹（M6 开放）</p>
        <p>把好用的句子存下来，跨对象复用时会标注来源对象，避免真的串号。</p>
      </div>
    </div>
  </div>
</template>
