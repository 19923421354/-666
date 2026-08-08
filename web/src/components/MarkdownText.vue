<script setup>
// 轻量 Markdown 渲染（零依赖、防 XSS）：支持代码块、行内代码、加粗、斜体、标题、列表、引用、链接、段落
import { ref, computed } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
  fold: { type: Boolean, default: true },
  foldAt: { type: Number, default: 600 },
})

const folded = ref(true)

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`)
}

const html = computed(() => {
  const raw = props.text || ''
  const isFold = props.fold && folded.value && raw.length > props.foldAt
  const src = isFold ? raw.slice(0, props.foldAt) + '…' : raw

  const lines = src.split('\n')
  const out = []
  let i = 0
  let inCode = false
  let codeBuf = []
  let listOpen = false
  let quoteOpen = false

  function closeList() {
    if (listOpen) {
      out.push('</ul>')
      listOpen = false
    }
  }
  function closeQuote() {
    if (quoteOpen) {
      out.push('</blockquote>')
      quoteOpen = false
    }
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      closeList()
      closeQuote()
      if (!inCode) {
        inCode = true
        codeBuf = []
      } else {
        inCode = false
        out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
      }
      i++
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      i++
      continue
    }

    if (!trimmed) {
      closeList()
      closeQuote()
      i++
      continue
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      closeList()
      closeQuote()
      const level = Math.min(3, trimmed.match(/^#+/)[0].length)
      out.push(`<h${level}>${inline(escapeHtml(trimmed.replace(/^#+\s/, '')))}</h${level}>`)
      i++
      continue
    }

    if (/^[-*]\s/.test(trimmed)) {
      if (!listOpen) {
        out.push('<ul>')
        listOpen = true
      }
      out.push(`<li>${inline(escapeHtml(trimmed.replace(/^[-*]\s/, '')))}</li>`)
      i++
      continue
    }

    if (/^>\s?/.test(trimmed)) {
      closeList()
      if (!quoteOpen) {
        out.push('<blockquote>')
        quoteOpen = true
      }
      out.push(`<p>${inline(escapeHtml(trimmed.replace(/^>\s?/, '')))}</p>`)
      i++
      continue
    }

    closeList()
    closeQuote()
    out.push(`<p>${inline(escapeHtml(trimmed))}</p>`)
    i++
  }

  if (inCode) out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
  closeList()
  closeQuote()

  return out.join('\n')
})

const needsFold = computed(() => props.fold && props.text.length > props.foldAt)
</script>

<template>
  <div class="mdx">
    <div class="md" v-html="html"></div>
    <button v-if="needsFold" class="fold-btn" @click="folded = !folded">
      {{ folded ? '展开全文 ▾' : '收起全文 ▴' }}
    </button>
  </div>
</template>

<style scoped>
.md :deep(p) {
  margin: 0 0 8px;
}
.md :deep(p:last-child) {
  margin-bottom: 0;
}
.md :deep(h1), .md :deep(h2), .md :deep(h3) {
  font-size: 15px;
  font-weight: 700;
  margin: 10px 0 6px;
}
.md :deep(code) {
  background: rgba(127, 127, 127, 0.15);
  border-radius: 5px;
  padding: 1px 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9em;
}
.md :deep(pre) {
  background: rgba(0, 0, 0, 0.45);
  border-radius: 10px;
  padding: 10px 12px;
  overflow-x: auto;
  margin: 8px 0;
  font-size: 13px;
  line-height: 1.5;
}
.md :deep(pre code) {
  background: transparent;
  padding: 0;
  color: #d6f0a8;
}
.md :deep(ul) {
  margin: 4px 0 8px;
  padding-left: 20px;
}
.md :deep(li) {
  margin: 2px 0;
}
.md :deep(blockquote) {
  border-left: 3px solid var(--accent-a);
  padding: 2px 12px;
  margin: 6px 0;
  color: var(--text-dim);
}
.md :deep(a) {
  color: var(--accent-a);
  text-decoration: underline;
}
.md :deep(strong) {
  font-weight: 700;
}
.md :deep(em) {
  font-style: italic;
}
.fold-btn {
  margin-top: 6px;
  font-size: 12px;
  color: var(--accent-a);
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(124, 108, 255, 0.12);
}
</style>
