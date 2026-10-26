
<script setup lang="ts">
export type ResizeAction =
  | 'add-left'
  | 'add-right'
  | 'add-top'
  | 'add-bottom'
  | 'remove-left'
  | 'remove-right'
  | 'remove-top'
  | 'remove-bottom'

const props = defineProps<{
  x: number
  y: number
  canRemoveColumn: boolean
  canRemoveRow: boolean
}>()

const emit = defineEmits<{
  select: [action: ResizeAction]
}>()

const actions: {
  label: string
  action: ResizeAction
  group: 'add' | 'remove'
}[] = [
  { label: 'Add a column to left', action: 'add-left', group: 'add' },
  { label: 'Add a column to right', action: 'add-right', group: 'add' },
  { label: 'Add a row above', action: 'add-top', group: 'add' },
  { label: 'Add a row below', action: 'add-bottom', group: 'add' },
  { label: 'Remove the leftmost column', action: 'remove-left', group: 'remove' },
  { label: 'Remove the rightmost column', action: 'remove-right', group: 'remove' },
  { label: 'Remove the top row', action: 'remove-top', group: 'remove' },
  { label: 'Remove the bottom row', action: 'remove-bottom', group: 'remove' }
]

function isDisabled(action: ResizeAction): boolean {
  if (action === 'remove-left' || action === 'remove-right') {
    return !props.canRemoveColumn
  }
  if (action === 'remove-top' || action === 'remove-bottom') {
    return !props.canRemoveRow
  }
  return false
}
</script>

<template>
  <div
    class="context-menu"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @contextmenu.prevent
    @mousedown.stop
  >
    <template v-for="group in ['add', 'remove']" :key="group">
      <div class="menu-heading">
        {{ group === 'add' ? 'ADD' : 'REMOVE' }}
      </div>

      <button
        v-for="item in actions.filter(a => a.group === group)"
        :key="item.action"
        type="button"
        :disabled="isDisabled(item.action)"
        @click="emit('select', item.action)"
      >
        {{ item.label }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 220px;
  padding: 6px;
  border: 1px solid #555;
  border-radius: 8px;
  background: #292929;
  color: white;
  box-shadow: 0 6px 20px #0005;
}

.menu-heading {
  padding: 9px 10px 5px;
  font-size: 11px;
  font-weight: 600;
  color: #aaa;
}

button {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: #454545;
}

button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
