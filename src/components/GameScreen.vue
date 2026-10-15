<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { sb, ensureAuth, getUserId } from '../supabase'
import { ICONS, R, C, LV, LEVEL_NAMES, deal, rowOk, rowsDone } from '../game'
import ConfirmDialog from './ConfirmDialog.vue'

const props = defineProps({
  mode: String, // 'solo' | 'online'
  level: { type: Number, default: 0 },
  game: Object,
})
const emit = defineEmits(['exit'])

const online = props.mode === 'online'
const lim = online ? LV[0] : LV[props.level]

const board = ref([])
const hid = ref(new Set())
const up = ref([])
const sel = ref(null)
const moves = ref(0)
const t0 = ref(0)
const now = ref(Date.now())
const started = ref(false)
const over = ref(true)
const msg = ref('')
const overlay = ref(null) // { title, text }
const curGame = ref(null)
const oppRows = ref(0)
const hasOpp = ref(false)
const showLeave = ref(false)

let ticker = null
let chan = null
let me = null
let finishedHandled = false

const done = computed(() => (board.value.length ? rowsDone(board.value) : 0))
const waitingForOpp = computed(() => online && curGame.value?.status === 'waiting')
const countdown = computed(() => started.value && now.value - t0.value < 0)

const timeText = computed(() => {
  if (!started.value) return '0:00'
  const ms = now.value - t0.value
  if (ms < 0) return 'Go in ' + Math.ceil(-ms / 1000)
  const e = Math.floor(ms / 1000)
  const s = lim.t ? Math.max(0, lim.t - e) : e
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
})

function cardInfo(id, i) {
  const s = Math.floor(id / C)
  const lock = rowOk(board.value, Math.floor(i / C))
  const hide = hid.value.has(id) && !up.value.includes(id) && !lock
  return { s, lock, hide, rank: (id % C) + 1 }
}

function begin(seed, startAt) {
  up.value = []
  hid.value = new Set(deal(seed + 7).slice(0, online ? 10 : lim.h))
  board.value = deal(seed)
  moves.value = 0
  sel.value = null
  over.value = false
  started.value = true
  t0.value = startAt || Date.now()
  now.value = Date.now()
  clearInterval(ticker)
  ticker = setInterval(tick, 200)
}

function tick() {
  if (over.value) return
  now.value = Date.now()
  const ms = now.value - t0.value
  if (ms < 0 || !lim.t) return
  if (lim.t - Math.floor(ms / 1000) <= 0) end('Time up', 'You ran out of time.')
}

function end(title, text) {
  over.value = true
  clearInterval(ticker)
  overlay.value = { title, text }
}

function tap(i) {
  if (over.value || rowOk(board.value, Math.floor(i / C))) return
  const cid = board.value[i]
  if (hid.value.has(cid) && !up.value.includes(cid)) {
    // peek: flips face up, no swap
    up.value = [...up.value, cid].slice(-2)
    return
  }
  if (sel.value === null) { sel.value = i; return }
  if (sel.value === i) { sel.value = null; return }

  const b = board.value
  const x = b[sel.value], y = b[i];
  [b[sel.value], b[i]] = [y, x]
  up.value = up.value.filter(v => v !== x && v !== y)
  moves.value++
  sel.value = null
  if (lim.d && moves.value % lim.d === 0) drift()

  if (!online && rowsDone(b) === R) return finishSolo()
  progress()
  if (!over.value && lim.m && moves.value >= lim.m) end('Out of moves', 'You used all ' + lim.m + ' moves.')
}

function drift() {
  const f = board.value.map((_, i) => i).filter(i => !rowOk(board.value, Math.floor(i / C)))
  if (f.length < 2) return
  const a = f[Math.floor(Math.random() * f.length)]
  let b = a
  while (b === a) b = f[Math.floor(Math.random() * f.length)]
  const arr = board.value;
  [arr[a], arr[b]] = [arr[b], arr[a]]
  msg.value = 'Drift! Two loose cards swapped places.'
}

async function finishSolo() {
  const ms = Date.now() - t0.value
  const mv = moves.value
  end('Solved', (ms / 1000).toFixed(1) + 's in ' + mv + ' moves')
  if (!sb) return
  try {
    await ensureAuth()
    const { data, error } = await sb.rpc('submit_solo_score', {
      p_level: props.level, p_time_ms: ms, p_moves: mv, p_board: board.value.slice(),
    })
    if (!error && data) overlay.value = { ...overlay.value, text: overlay.value.text + ' - Global rank #' + data + ' on ' + LEVEL_NAMES[props.level] }
  } catch {}
}

// ---- multiplayer ----
async function progress() {
  if (!online || !curGame.value) return
  const { data } = await sb.rpc('report_progress', { p_game: curGame.value.id, p_moves: moves.value, p_board: board.value })
  if (data) onGame(data)
}

function onGame(g) {
  curGame.value = g
  if (g.status === 'waiting') {
    msg.value = 'Waiting for an opponent...'
    over.value = true
  } else if (g.status === 'playing' && !started.value) {
    begin(g.seed, new Date(g.started_at).getTime())
    msg.value = 'Race! First to lock 5 rows wins.'
  } else if (g.status === 'finished' && !finishedHandled) {
    finishedHandled = true
    const won = g.winner_id === me
    end(
      won ? 'You win' : 'Opponent won',
      won ? (done.value < R ? 'Your opponent left the match.' : 'You locked every row first.') : 'They locked every row first.',
    )
  } else if (g.status === 'cancelled') {
    end('Room closed', 'Your opponent left before the game started.')
  }
}

async function enter() {
  me = await ensureAuth()
  const g = props.game
  hasOpp.value = true
  chan = sb.channel('game-' + g.id)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: 'id=eq.' + g.id }, p => onGame(p.new))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: 'game_id=eq.' + g.id }, p => {
      if (p.new && p.new.user_id !== me) oppRows.value = p.new.rows_done
    })
    .subscribe()
  onGame(g)
}

function leaveMatch() {
  if (over.value) return doLeave()
  showLeave.value = true
}

// Close the dialog if the game ends while it is open (win, loss, timeout).
watch(over, (v) => { if (v) showLeave.value = false })

async function doLeave() {
  showLeave.value = false
  const g = curGame.value
  if (online && g && g.status !== 'finished' && g.status !== 'cancelled' && sb) {
    try { await sb.rpc('forfeit_game', { p_game: g.id }) } catch {}
  }
  emit('exit')
}

onMounted(async () => {
  if (!online) {
    msg.value = props.level
      ? 'Tap a face-down card to peek. Only 2 stay face up. Tap two face-up cards to swap.'
      : 'Solo game. Lock all 5 rows.'
    begin(Date.now() % 1e9, 0)
  } else {
    try { await enter() } catch (e) { msg.value = e.message }
  }
})

onBeforeUnmount(() => {
  clearInterval(ticker)
  if (chan && sb) sb.removeChannel(chan)
})
</script>

<template>
  <div>
    <div class="bar">
      <div><div class="l">Time</div><div class="v">{{ timeText }}</div></div>
      <div><div class="l">Rows locked</div><div class="v">{{ done }}/{{ R }}</div></div>
      <div><div class="l">Moves</div><div class="v">{{ moves }}{{ lim.m ? '/' + lim.m : '' }}</div></div>
    </div>

    <div v-if="hasOpp" class="opp">
      <span>{{ oppRows ? 'Opponent: ' + oppRows + '/' + R + ' rows' : 'Opponent' }}</span>
      <div class="track"><i :style="{ width: (oppRows / R * 100) + '%' }"></i></div>
    </div>

    <div class="board" :class="{ wait: countdown }">
      <div v-if="waitingForOpp" class="wt">
        {{ curGame.room_code ? 'Share this room code' : 'Finding an opponent...' }}
        <span v-if="curGame.room_code">{{ curGame.room_code }}</span>
      </div>
      <template v-else>
        <div
          v-for="(id, i) in board"
          :key="i"
          class="card"
          :class="[
            's' + cardInfo(id, i).s,
            { ok: cardInfo(id, i).lock, sel: sel === i, back: cardInfo(id, i).hide },
          ]"
          @click="tap(i)"
        >
          <template v-if="cardInfo(id, i).hide">?</template>
          <template v-else>
            <b>{{ cardInfo(id, i).rank }}</b>
            <img class="pip" :class="'p' + cardInfo(id, i).s" :src="ICONS[cardInfo(id, i).s]" alt="" draggable="false" />
          </template>
        </div>
      </template>
    </div>

    <div class="panel">
      <div class="msg">{{ msg }}</div>
      <button class="leave" @click="leaveMatch">Leave match</button>
    </div>

    <ConfirmDialog
      :open="showLeave"
      :title="online ? 'Leave the match?' : 'Leave this game?'"
      :text="online ? 'You will forfeit and your opponent wins.' : 'Your progress on this board will be lost.'"
      :confirm-text="online ? 'Forfeit' : 'Leave'"
      cancel-text="Keep playing"
      danger
      @confirm="doLeave"
      @cancel="showLeave = false"
    />

    <div v-if="overlay" class="ov">
      <h1>{{ overlay.title }}</h1>
      <p>{{ overlay.text }}</p>
      <button class="go" style="flex:none;padding:0 28px" @click="emit('exit')">Back to lobby</button>
    </div>
  </div>
</template>