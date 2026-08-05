<script setup>
defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
})
const emit = defineEmits(['close'])
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="sheet-mask" @click="emit('close')"></div>
    </Transition>
    <Transition name="slide-up">
      <div v-if="show" class="sheet">
        <div class="sheet-handle"></div>
        <div v-if="title" class="sheet-title">{{ title }}</div>
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-title {
  font-size: 17px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 12px;
}
</style>
