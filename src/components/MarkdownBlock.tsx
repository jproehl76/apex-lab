import DOMPurify from 'dompurify';

function renderMarkdown(text: string): string {
  const raw = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)(\n|$)/gs, (m) => `<ul>${m}</ul>`)
    .replace(/<\/ul><ul>/g, '')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(?!<[hulp])(.+)$/gm, '$1');
  return DOMPurify.sanitize(`<p>${raw}</p>`, { USE_PROFILES: { html: true } });
}

export function MarkdownBlock({ text }: { text: string }) {
  return (
    <div
      className="coaching-md"
      style={{ fontFamily: 'BMWTypeNext', fontSize: 13, lineHeight: 1.65, color: '#D0D0E8' }}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  );
}
