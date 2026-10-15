<script setup>
import { ref, onMounted } from 'vue'
import { sb, saveUsername, loadUsername, getLocalName, setLocalName, getUserId } from '../supabase'

const props = defineProps({ initial: { type: String, default: '' } })
const emit = defineEmits(['done'])

const name = ref(props.initial || getLocalName())
const msg = ref('')
const busy = ref(false)

// If this device already has a saved profile name, prefill it.
onMounted(async () => {
  if (name.value || !sb) return
  try {
    const n = await loadUsername()
    if (n && !name.value) name.value = n
  } catch {}
})

async function submit() {
  const v = name.value.trim()
  if (v.length < 3) { msg.value = 'Name needs at least 3 characters.'; return }
  busy.value = true
  msg.value = ''
  try {
    setLocalName(v)
    if (!sb) {
      // No Supabase configured: let the player continue with solo play.
      emit('done', { name: v, id: null })
      return
    }
    const id = await saveUsername(v)
    emit('done', { name: v, id })
  } catch (e) {
    msg.value = e.message || 'Could not save your name.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="title">ROW RUSH</h1>
    <p class="sub">Sort the deck so every row holds one style, from 1 to 6.</p>
    <form class="panel first" @submit.prevent="submit">
      <div class="who">Choose your player name. It shows on the leaderboards.</div>
      <input
        v-model="name"
        class="plain"
        maxlength="16"
        placeholder="Your name"
        autocomplete="nickname"
        autofocus
      />
      <button class="go" type="submit" :disabled="busy">{{ busy ? 'Saving...' : 'Continue' }}</button>
      <div class="msg">{{ msg }}</div>
    </form>
  </div>
</template>
