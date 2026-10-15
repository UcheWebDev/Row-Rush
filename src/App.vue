<script setup>
import { ref } from 'vue'
import NameScreen from './components/NameScreen.vue'
import LobbyScreen from './components/LobbyScreen.vue'
import GameScreen from './components/GameScreen.vue'
import LeaderboardScreen from './components/LeaderboardScreen.vue'

const screen = ref('name') // name -> lobby -> game | lb
const player = ref({ name: '', id: null })
const gameCfg = ref(null)
const gameKey = ref(0)

function onNamed(p) {
  player.value = p
  screen.value = 'lobby'
}
function onStart(cfg) {
  gameCfg.value = cfg
  gameKey.value++
  screen.value = 'game'
}
</script>

<template>
  <div class="frame">
    <NameScreen v-if="screen === 'name'" :initial="player.name" @done="onNamed" />
    <LobbyScreen
      v-else-if="screen === 'lobby'"
      :name="player.name"
      @start="onStart"
      @leaderboards="screen = 'lb'"
      @rename="screen = 'name'"
    />
    <GameScreen
      v-else-if="screen === 'game'"
      :key="gameKey"
      :mode="gameCfg.mode"
      :level="gameCfg.level || 0"
      :game="gameCfg.game"
      @exit="screen = 'lobby'"
    />
    <LeaderboardScreen v-else-if="screen === 'lb'" @back="screen = 'lobby'" />
  </div>
</template>
