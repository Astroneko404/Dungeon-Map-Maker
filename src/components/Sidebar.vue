<script setup lang="ts">
  import wallIcon from '@/assets/legend/wall.svg?url'
  import doorIcon from '@/assets/legend/door.svg?url'
  import oneWayIcon from '@/assets/legend/onewaydoor.svg?url'
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
    <!-- EDGE TOOLS -->
    <div class="section">
      <div class="section-title">Edge</div>

      <div class="grid">
        <button 
          :class="{ active: props.tool === 'wall' }"
          @click="emit('changeTool', 'wall')"
        >
          <img :src="wallIcon" />
          <span>Wall</span>
        </button>

        <button 
          :class="{ active: props.tool === 'door' }"
          @click="emit('changeTool', 'door')"
        >
          <img :src="doorIcon" />
          <span>Door</span>
        </button>

        <button 
          :class="{ active: props.tool === 'dooroneway' }"
          @click="emit('changeTool', 'dooroneway')"
        >
          <img :src="oneWayIcon" />
          <span>One-way Door</span>
        </button>
      </div>
    </div>

    <!-- CELL TOOLS -->
    <div class="section">
      <div class="section-title">Cell</div>

      <div class="grid">
        <!-- placeholder for future tools -->
        <button disabled>
          <div class="placeholder" />
          <span>Empty</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  width: 180px;
  min-width: 180px;
  background: #2b2b2b;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Section */
.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 12px;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Grid layout */
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

/* Tool button */
button {
  background: #3a3a3a;
  border: none;
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;

  color: white;
  font-size: 11px;
}

button:hover {
  background: #4a4a4a;
}

button.active {
  background: #00aaff;
}

/* Icon */
img {
  width: 28px;
  height: 28px;
  filter: invert(1);
}

/* Placeholder for future tools */
.placeholder {
  width: 28px;
  height: 28px;
  background: #555;
  border-radius: 4px;
}
</style>