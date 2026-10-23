<script setup lang="ts">
import { ref, toRaw } from 'vue'
import Sidebar from './components/Sidebar.vue'
import DungeonCanvas from './components/DungeonCanvas.vue'
import HeaderBar from './components/HeadBar.vue'

type Tool = 'wall' | 'door' | 'downstair' | 'upstair' | "walkable"
const currentTool = ref<Tool>('wall')

const canvasRef = ref<InstanceType<typeof DungeonCanvas> | null>(null)

function newMap () {
  canvasRef.value?.newMap()
}

function exportMap() {
  return canvasRef.value?.exportMap() ?? ''
}

function exportSvg(
  exportIcons: boolean,
  lineColor: string,
  fillColor: string
): string {
  if (!canvasRef.value) {
    throw new Error('Canvas reference is not available')
  }
  return canvasRef.value.exportSVG(
    exportIcons,
    lineColor,
    fillColor
  )
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
      :newMap="newMap"
      :exportSvg="exportSvg"
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
  flex-direction: column;
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