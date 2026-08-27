<template>
  <q-dialog
    v-model="showDialog"
    position="bottom"
    :persistent="persistent"
    :aria-label="title ?? message ?? actions.confirm.label"
  >
    <ZKBottomDialogContainer>
      <div class="confirm-dialog">
        <div class="dialog-header">
          <h3 v-if="title" class="dialog-title">{{ title }}</h3>
          <div v-if="$slots.default" class="dialog-message">
            <slot />
          </div>
          <p v-else-if="message" class="dialog-message">{{ message }}</p>
        </div>

        <div
          class="dialog-actions"
          :class="{ 'dialog-actions--three': actions.leading !== undefined }"
        >
          <PrimeButton
            v-for="action in orderedActions"
            :key="action.name"
            :label="action.label"
            :severity="
              actionPresentationByAppearance[action.appearance].severity
            "
            :outlined="
              actionPresentationByAppearance[action.appearance].outlined
            "
            class="dialog-action"
            :class="{
              'dialog-action--warning-filled': action.appearance === 'warning',
            }"
            @click="handleAction(action.name)"
          />
        </div>
      </div>
    </ZKBottomDialogContainer>
  </q-dialog>
</template>

<script setup lang="ts">
import Button from "primevue/button";
import { computed } from "vue";

import ZKBottomDialogContainer from "./ZKBottomDialogContainer.vue";
import type {
  ConfirmDialogAction,
  ConfirmDialogActionAppearance,
  ConfirmDialogActions,
} from "./ZKConfirmDialog.types";

defineOptions({
  components: {
    PrimeButton: Button,
  },
});

const props = withDefaults(defineProps<Props>(), {
  title: undefined,
  message: undefined,
  persistent: false,
});

const emit = defineEmits<Emits>();

type ConfirmDialogActionName = keyof ConfirmDialogActions;

interface OrderedConfirmDialogAction extends ConfirmDialogAction {
  readonly name: ConfirmDialogActionName;
}

interface Props {
  actions: ConfirmDialogActions;
  title?: string;
  message?: string;
  persistent?: boolean;
}

interface Emits {
  (e: "confirm"): void;
  (e: "cancel"): void;
  (e: "leading"): void;
}

const showDialog = defineModel<boolean>({ required: true });
const actionPresentationByAppearance = {
  primary: { severity: "primary", outlined: false },
  "primary-outlined": { severity: "primary", outlined: true },
  secondary: { severity: "secondary", outlined: false },
  "secondary-outlined": { severity: "secondary", outlined: true },
  danger: { severity: "danger", outlined: false },
  "danger-outlined": { severity: "danger", outlined: true },
  warning: { severity: "warn", outlined: false },
  "warning-outlined": { severity: "warn", outlined: true },
} satisfies Record<
  ConfirmDialogActionAppearance,
  {
    severity: "primary" | "secondary" | "danger" | "warn";
    outlined: boolean;
  }
>;

const orderedActions = computed<readonly OrderedConfirmDialogAction[]>(() => {
  const { leading, cancel, confirm } = props.actions;
  const requiredActions: readonly OrderedConfirmDialogAction[] = [
    { name: "cancel", ...cancel },
    { name: "confirm", ...confirm },
  ];

  return leading === undefined
    ? requiredActions
    : [{ name: "leading", ...leading }, ...requiredActions];
});

function handleAction(actionName: ConfirmDialogActionName): void {
  switch (actionName) {
    case "leading":
      emit("leading");
      break;
    case "cancel":
      emit("cancel");
      break;
    case "confirm":
      emit("confirm");
      break;
  }
  showDialog.value = false;
}
</script>

<style scoped lang="scss">
.confirm-dialog {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  color: $primary;
}

.dialog-header {
  .dialog-title {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    font-weight: var(--font-weight-semibold);
    color: $color-text-strong;
    line-height: 1.35;
    text-align: center;
  }

  .dialog-message {
    margin: 0;
    font-size: 1rem;
    font-weight: var(--font-weight-normal);
    color: black;
    line-height: 1.5;
    text-align: start;
  }
}

.dialog-actions {
  display: flex;
  gap: 1rem;
  justify-content: stretch;

  .dialog-action {
    flex: 1;
  }

  .dialog-action--warning-filled.p-button.p-button-warn {
    color: white;
    background-color: $warning;
    border-color: $warning;

    &:not(:disabled):hover {
      color: white;
      background-color: $warning;
      border-color: $warning;
      filter: brightness(0.96);
    }
  }

  &.dialog-actions--three {
    flex-direction: column;
  }
}
</style>
