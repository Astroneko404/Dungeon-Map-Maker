<script setup lang="ts">
import { ref } from 'vue'
import Sidebar from './components/Sidebar.vue'
import DungeonCanvas from './components/DungeonCanvas.vue'
import HeaderBar from './components/HeadBar.vue'

type Tool = 'wall' | 'door' | 'dooroneway'
const currentTool = ref<Tool>('wall')

const canvasRef = ref<InstanceType<typeof DungeonCanvas> | null>(null)

function exportMap() {
  return canvasRef.value?.exportMap() ?? ''
}

function importMap(json: string) {
  canvasRef.value?.importMap(json)
}
</script>

<template>
  <div class="app">
    <HeaderBar
      :exportMap="exportMap"
      :importMap="importMap"
    />
    <div class="main">
      <Sidebar 
        :tool="currentTool"
        @changeTool="currentTool = $event" 
      />

      <DungeonCanvas 
        ref="canvasRef"
        :tool="currentTool" 
      />
    </div>
  </div>
</template>

<style>
.app {
  display: flex;
  flex-direction: column; /* KEY */
  height: 100vh;
}
.main {
  display: flex;
  flex: 1;
}
canvas{
    display: block;
}
</style>