<script setup lang="ts">
import { ref, toRaw } from 'vue'
import Sidebar from './components/Sidebar.vue'
import DungeonCanvas from './components/DungeonCanvas.vue'
import HeaderBar from './components/HeadBar.vue'
import type { Tool } from '@/types/game'
import type { ResizeAction } from './components/ContextMenu.vue'

const currentTool = ref<Tool>('wall')

const canvasRef = ref<InstanceType<typeof DungeonCanvas> | null>(null)

function exportImage(format: "png" | "jpeg"): string {
  if (!canvasRef.value) {
    throw new Error('Canvas is not ready')
  }

  return canvasRef.value.exportImage(format)
}

function exportMap() {
  return canvasRef.value?.exportMap() ?? ''
}

function exportSvg(
  includeIcon: boolean,
  includeTitle: boolean,
  mapTitle: string,
  lineColor: string,
  fillColor: string
): string {
  if (!canvasRef.value) {
    throw new Error('Canvas reference is not available')
  }
  return canvasRef.value.exportSVG(
    includeIcon,
    includeTitle,
    mapTitle,
    lineColor,
    fillColor
  )
}

function importMap(json: string) {
  canvasRef.value?.importMap(json)
}

function newMap () {
  canvasRef.value?.newMap()
}

function resizeMap(action: ResizeAction): void {
  canvasRef.value?.resizeMap(action)
}
</script>

<template>
  <div class="app">
    <HeaderBar
      :exportMap="exportMap"
      :importMap="importMap"
      :newMap="newMap"
      :exportSvg="exportSvg"
      :exportImage="exportImage"
    />
    <div class="main">
      <Sidebar 
        :tool="currentTool"
        @changeTool="currentTool = $event" 
        @resizeMap="resizeMap"
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