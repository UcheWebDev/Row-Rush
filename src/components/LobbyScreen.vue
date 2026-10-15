<script setup>
import { ref } from 'vue'
import { sb, ensureAuth } from '../supabase'
import { canInstall, isIOS, isStandalone, promptInstall } from '../install'

defineProps({ name: String })
const emit = defineEmits(['start', 'leaderboards', 'rename'])

const level = ref(1)
const code = ref('')
const msg = ref('')
const busy = ref(false)

function solo() {
  emit('start', { mode: 'solo', level: Number(level.value) })
}

async function net(fn, args) {
  if (busy.value) return
  busy.value = true
  msg.value = ''
  try {
    await ensureAuth()
    const { data, error } = await sb.rpc(fn, args || {})
    if (error) throw error
    emit('start', { mode: 'online', game: data })
  } catch (e) {
    msg.value = e.message
  } finally {
    busy.value = false
  }
}

function join() {
  const c = code.value.trim().toUpperCase()
  if (c) net('join_room', { p_code: c })
}
</script>

<template>
  <div>
    <h1 class="title">ROW RUSH</h1>
    <p class="sub">Sort the deck so every row holds one style, from 1 to 6.</p>
    <div class="panel first">
      <div class="who">Playing as <b>{{ name }}</b></div>
      <button @click="emit('rename')">Change name</button>
      <select v-model="level">
        <option :value="0">Normal</option>
        <option :value="1">Hard: 10 hidden cards, 5:00</option>
        <option :value="2">Brutal: 15 hidden, drift, 4:00, 120 moves</option>
      </select>
      <button class="go" @click="solo">Play solo</button>
      <button :disabled="busy" @click="net('quick_match')">Quick match</button>
      <button :disabled="busy" @click="net('create_room')">Create private room</button>
      <button @click="emit('leaderboards')">Leaderboards</button>
      <input v-model="code" maxlength="5" placeholder="ROOM CODE" />
      <button :disabled="busy" @click="join">Join room</button>
      <button v-if="canInstall" @click="promptInstall">Install app</button>
      <div v-else-if="isIOS && !isStandalone" class="who">
        To install: tap Share, then Add to Home Screen.
      </div>
      <div class="msg">{{ msg }}</div>
    </div>
  </div>
</template>
