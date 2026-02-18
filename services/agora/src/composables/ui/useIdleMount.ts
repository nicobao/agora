import { onMounted, onUnmounted, type Ref, ref } from "vue";

export interface UseIdleMountOptions {
  /**
   * Maximum time to wait before forcing mount (ms)
   * @default 2000
   */
  timeout?: number;

  /**
   * Delay before mounting (for setTimeout fallback)
   * @default 100
   */
  delay?: number;

  /**
   * Mount immediately on component mount (disable idle defer)
   * @default false
   */
  immediate?: boolean;
}

export interface UseIdleMountReturn {
  /**
   * Whether the component should be mounted
   */
  isMounted: Ref<boolean>;

  /**
   * Manually trigger mount (useful for override scenarios)
   */
  mount: () => void;
}

/**
 * Composable to defer mounting of heavy components until browser is idle
 *
 * Usage:
 * ```typescript
 * const { isMounted } = useIdleMount({ timeout: 2000 });
 * ```
 *
 * In template:
 * ```vue
 * <HeavyComponent v-if="isMounted" />
 * ```
 */
export function useIdleMount(
  options?: UseIdleMountOptions
): UseIdleMountReturn {
  const { timeout = 2000, delay = 100, immediate = false } = options ?? {};

  const isMounted = ref(immediate);

  function mount(): void {
    isMounted.value = true;
  }

  let idleCallbackHandle: ReturnType<typeof requestIdleCallback> | undefined;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  onMounted(() => {
    if (immediate) return;

    if ("requestIdleCallback" in window) {
      idleCallbackHandle = requestIdleCallback(mount, { timeout });
    } else {
      // Fallback for Safari/older browsers that don't support requestIdleCallback
      timeoutHandle = setTimeout(mount, delay);
    }
  });

  onUnmounted(() => {
    if (idleCallbackHandle !== undefined) {
      cancelIdleCallback(idleCallbackHandle);
    }
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  });

  return {
    isMounted,
    mount,
  };
}
