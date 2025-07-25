<!-- eslint-disable vue/no-v-html -->
<template>
  <span
    class="textBreak"
    :class="{ truncate: compactMode, coloredHrefs: !compactMode }"
    role="user-content"
    :aria-label="compactMode ? 'Post content preview' : 'Post content'"
    @click="handleClick"
    v-html="sanitizedHtmlBody()"
  ></span>
</template>

<script setup lang="ts">
import { processHtmlBody } from "../../shared/shared";

const props = defineProps<{
  htmlBody: string;
  compactMode: boolean;
  enableLinks: boolean;
}>();

const sanitizedHtmlBody = () => {
  try {
    return processHtmlBody(props.htmlBody, props.enableLinks);
  } catch (error) {
    console.error("Error sanitizing HTML content:", error);
    // Fallback to plain text if sanitization fails
    return props.htmlBody.replace(/<[^>]*>/g, "");
  }
};

const handleClick = (event: Event) => {
  const target = event.target as HTMLElement;
  // Check if the clicked element is a link or is inside a link
  const link = target.closest("a[href]");
  if (link) {
    // Prevent the click from propagating to parent elements
    event.stopPropagation();
  }
};
</script>

<style lang="scss" scoped>
:deep(a[href]) {
  color: rgb(0, 121, 211);
  font-weight: 500;
  margin-right: 0.25rem;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  line-clamp: 5;
  -webkit-box-orient: vertical;
}

.textBreak {
  word-break: break-word;
  /* Prevent potential layout issues with long content */
  overflow-wrap: break-word;
  hyphens: auto;
}

/* Ensure any remaining potentially dangerous content is hidden */
:deep(script),
:deep(iframe),
:deep(object),
:deep(embed) {
  display: none !important;
}
</style>
