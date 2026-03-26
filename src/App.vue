<script setup lang="ts">
import { ref } from 'vue'
import Sidebar from './components/Sidebar.vue'
import DungeonCanvas from './components/DungeonCanvas.vue'

type Tool = 'wall' | 'door' | 'dooroneway'
const currentTool = ref<Tool>('wall')
</script>

<template>
  <div class="app">
    <Sidebar 
        :tool="currentTool"
        @changeTool="currentTool = $event" />
    <DungeonCanvas :tool="currentTool" />
  </div>
</template>

<style>
.app {
  display: flex;
  height: 100vh;
}
canvas{
    display: block;
}
</style>