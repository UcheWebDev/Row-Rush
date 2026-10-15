<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'

const props = defineProps({
  open: Boolean,
  title: { type: String, default: 'Are you sure?' },
  text: { type: String, default: '' },
  confirmText: { type: String, default: 'Confirm' },
  cancelText: { type: String, default: 'Cancel' },
  danger: Boolean,
})
const emit = defineEmits(['confirm', 'cancel'])

const cancelBtn = ref(null)

function onKey(e) {
  if (e.key === 'Escape') emit('cancel')
}

watch(
  () => props.open,
  async (v) => {
    if (v) {
      window.addEventListener('keydown', onKey)
      await nextTick()
      cancelBtn.value?.focus() // safe default: the non-destructive choice
    } else {
      window.removeEventListener('keydown', onKey)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="dlg">
    <div v-if="open" class="dlg-back" @click.self="emit('cancel')">
      <div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-text">
        <h2 id="dlg-title">{{ title }}</h2>
        <p v-if="text" id="dlg-text">{{ text }}</p>
        <div class="dlg-actions">
          <button ref="cancelBtn" class="dlg-cancel" @click="emit('cancel')">{{ cancelText }}</button>
          <button :class="danger ? 'dlg-danger' : 'go'" @click="emit('confirm')">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>