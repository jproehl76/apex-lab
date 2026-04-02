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

const mdStyles = `
  .coaching-md {
    font-family: BMWTypeNext, system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.75;
    color: #D0D0E8;
  }
  .coaching-md p { margin-bottom: 0.75em; }
  .coaching-md p:last-child { margin-bottom: 0; }
  .coaching-md h3 {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #F0F0FA;
    margin: 1.2em 0 0.5em;
  }
  .coaching-md h3:first-child { margin-top: 0; }
  .coaching-md h4 {
    font-size: 15px;
    font-weight: 600;
    color: #C8C8E0;
    margin: 1em 0 0.4em;
  }
  .coaching-md strong {
    color: #F0F0FA;
    font-weight: 600;
  }
  .coaching-md ul {
    margin: 0.5em 0;
    padding-left: 1.4em;
  }
  .coaching-md li {
    margin-bottom: 0.3em;
  }
  .coaching-md li::marker {
    color: #6B6B88;
  }
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = mdStyles;
  document.head.appendChild(style);
}

export function MarkdownBlock({ text }: { text: string }) {
  injectStyles();
  return (
    <div
      className="coaching-md"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  );
}
