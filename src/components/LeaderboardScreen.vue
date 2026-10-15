<script setup>
import { ref, onMounted } from 'vue'
import { sb, ensureAuth, getUserId } from '../supabase'

const emit = defineEmits(['back'])

const tab = ref('solo')
const level = ref(1)
const rows = ref([])
const status = ref('Loading...')
const me = ref(null)

async function load() {
  status.value = 'Loading...'
  rows.value = []
  try {
    me.value = await ensureAuth()
    const q = tab.value === 'solo'
      ? sb.from('global_leaderboard').select('rank,user_id,username,best_time_ms,moves').eq('level', level.value).order('rank').limit(25)
      : sb.from('pvp_leaderboard').select('rank,user_id,username,rating,wins,losses,win_pct').order('rank').limit(25)
    const { data, error } = await q
    if (error) throw error
    rows.value = data
    status.value = data.length ? '' : 'No scores yet. Be the first.'
  } catch (e) {
    status.value = e.message
  }
}

function setTab(t) { tab.value = t; load() }
function setLevel(l) { level.value = l; load() }
function detail(r) {
  return tab.value === 'solo'
    ? (r.best_time_ms / 1000).toFixed(1) + 's - ' + r.moves + ' moves'
    : r.rating + ' pts - ' + r.wins + 'W ' + r.losses + 'L'
}

onMounted(load)
</script>

<template>
  <div>
    <h1 class="title small">LEADERBOARDS</h1>
    <div class="tabs">
      <button :class="{ on: tab === 'solo' }" @click="setTab('solo')">Global (solo)</button>
      <button :class="{ on: tab === 'pvp' }" @click="setTab('pvp')">PvP ranked</button>
    </div>
    <div v-show="tab === 'solo'" class="tabs">
      <button v-for="(n, i) in ['Normal', 'Hard', 'Brutal']" :key="n" :class="{ on: level === i }" @click="setLevel(i)">{{ n }}</button>
    </div>
    <div class="lbrows">
      <template v-if="rows.length">
        <div v-for="r in rows" :key="r.rank + r.user_id" class="lr" :class="{ me: r.user_id === me }">
          <b>{{ r.rank }}</b><span>{{ r.username }}</span><em>{{ detail(r) }}</em>
        </div>
      </template>
      <template v-else>{{ status }}</template>
    </div>
    <div style="margin-top:8px;display:flex"><button style="flex:1" @click="emit('back')">Back to lobby</button></div>
  </div>
</template>
