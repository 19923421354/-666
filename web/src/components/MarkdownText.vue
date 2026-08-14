<script setup>
// 轻量 Markdown 渲染（零依赖、防 XSS）：支持代码块、行内代码、加粗、斜体、删除线、标题、列表、任务列表、表格、引用、链接、段落
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
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`)
}

// 解析 markdown 表格：连续若干行以 | 开头，第二行为分隔行
function isTableRow(line) {
  const t = line.trim()
  return t.startsWith('|') && t.endsWith('|')
}

function renderTable(lines, start) {
  const rows = []
  let i = start
  while (i < lines.length && isTableRow(lines[i])) {
    rows.push(lines[i].trim())
    i++
  }
  if (rows.length < 2) return { html: '', next: start }
  const split = (row) =>
    row
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim())
  const isSep = (row) => /^:?-+:?$/.test(row.replace(/\s/g, ''))
  const header = split(rows[0])
  const body = rows.slice(1).filter((r) => !isSep(r))
  let out = '<table>'
  out += '<thead><tr>' + header.map((h) => `<th>${inline(escapeHtml(h))}</th>`).join('') + '</tr></thead>'
  out += '<tbody>'
  for (const row of body) {
    out += '<tr>' + split(row).map((c) => `<td>${inline(escapeHtml(c))}</td>`).join('') + '</tr>'
  }
  out += '</tbody></table>'
  return { html: out, next: i }
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
  let codeLang = ''
  let listOpen = false
  let quoteOpen = false
  let pOpen = false

  function closeP() {
    if (pOpen) {
      out.push('</p>')
      pOpen = false
    }
  }
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
  function closeAll() {
    closeP()
    closeList()
    closeQuote()
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      closeAll()
      if (!inCode) {
        inCode = true
        codeBuf = []
        codeLang = trimmed.slice(3).trim()
      } else {
        inCode = false
        const uid = 'cb' + Math.random().toString(36).slice(2, 8)
        out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre><button class="copy-code" data-uid="${uid}" data-code="${btoa(unescape(encodeURIComponent(codeBuf.join('\n'))))}">复制</button>`)
        codeLang = ''
      }
      i++
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      i++
      continue
    }

    if (isTableRow(trimmed)) {
      closeAll()
      const r = renderTable(lines, i)
      out.push(r.html)
      i = r.next
      continue
    }

    if (!trimmed) {
      closeAll()
      i++
      continue
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      closeAll()
      const level = Math.min(3, trimmed.match(/^#+/)[0].length)
      out.push(`<h${level}>${inline(escapeHtml(trimmed.replace(/^#+\s/, '')))}</h${level}>`)
      i++
      continue
    }

    if (/^[-*]\s/.test(trimmed) || /^\d+[.、]\s/.test(trimmed)) {
      closeP()
      closeQuote()
      if (!listOpen) {
        out.push('<ul>')
        listOpen = true
      }
      const isTask = /^[-*]\s\[([ xX])\]\s/.test(trimmed)
      if (isTask) {
        const done = /^[-*]\s\[[xX]\]\s/.test(trimmed)
        const rest = trimmed.replace(/^[-*]\s\[[ xX]\]\s/, '')
        out.push(
          `<li class="task ${done ? 'done' : ''}"><span class="tick">${done ? '✓' : ''}</span>${inline(escapeHtml(rest))}</li>`
        )
      } else {
        out.push(`<li>${inline(escapeHtml(trimmed.replace(/^[-*]\s/, '')))}</li>`)
      }
      i++
      continue
    }

    if (/^>\s?/.test(trimmed)) {
      closeP()
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
    if (!pOpen) {
      out.push('<p>')
      pOpen = true
    }
    out.push(inline(escapeHtml(trimmed)))
    i++
  }

  if (inCode) out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
  closeAll()

  return out.join('\n')
})

const needsFold = computed(() => props.fold && props.text.length > props.foldAt)

function onMdxClick(e) {
  const btn = e.target && e.target.closest
    ? e.target.closest('.copy-code')
    : null
  if (!btn) return
  const code = btn.getAttribute('data-code') || ''
  if (!code) return
  let text = ''
  try {
    text = decodeURIComponent(escape(atob(code)))
  } catch (err) {
    text = code
  }
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {})
  const old = btn.textContent
  btn.textContent = '已复制 ✓'
  setTimeout(() => (btn.textContent = old), 1200)
}
</script>

<template>
  <div class="mdx">
    <div class="md" v-html="html" @click="onMdxClick"></div>
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
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
}
.md :deep(.copy-code) {
  display: inline-block;
  margin: 4px 0 8px;
  font-size: 11px;
  color: var(--text-dim);
  background: var(--glass);
  border: 1px solid var(--glass-line);
  border-radius: 6px;
  padding: 2px 10px;
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
.md :deep(s) {
  text-decoration: line-through;
  opacity: 0.7;
}
.md :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  width: 100%;
  font-size: 13px;
  display: block;
  overflow-x: auto;
}
.md :deep(th), .md :deep(td) {
  border: 1px solid var(--line);
  padding: 6px 10px;
  text-align: left;
  white-space: nowrap;
}
.md :deep(th) {
  background: var(--card-2);
  font-weight: 700;
}
.md :deep(.task) {
  list-style: none;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: -20px;
}
.md :deep(.task .tick) {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid var(--text-faint);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #fff;
  background: var(--card-2);
  flex-shrink: 0;
}
.md :deep(.task.done .tick) {
  background: var(--ok);
  border-color: transparent;
}
.md :deep(.task.done) {
  opacity: 0.6;
  text-decoration: line-through;
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
