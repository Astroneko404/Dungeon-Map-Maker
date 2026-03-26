<script setup lang="ts">
type Tool = 'wall' | 'door' | 'dooroneway'

const emit = defineEmits<{
  (e: 'changeTool', tool: Tool): void
}>()

const props = defineProps<{
  tool: Tool
}>()
</script>

<template>
  <div class="sidebar">
    <button 
        :class="{ active: props.tool === 'wall' }"
        @click="emit('changeTool', 'wall')"
        >
        Wall
    </button>

    <button 
        :class="{ active: props.tool === 'door' }"
        @click="emit('changeTool', 'door')"
        >
        Door
    </button>

    <button 
        :class="{ active: props.tool === 'dooroneway' }"
        @click="emit('changeTool', 'dooroneway')"
        >
        One-way Door
    </button>
  </div>
</template>

<style scoped>
.sidebar {
  width: 160px;
  min-width: 160px;
  background: #2b2b2b;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

button {
  padding: 10px;
  border: none;
  cursor: pointer;
  background: #444;
  color: white;
}

button.active {
  background: #00aaff;
}
canvas {
  background: aliceblue;
}
</style>