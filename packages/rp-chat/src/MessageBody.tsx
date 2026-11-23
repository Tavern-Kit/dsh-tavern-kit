import React from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  a: ({ href, title, children }) => href
    ? <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>
    : <span title={title}>{children}</span>,
  img: ({ src, alt, title }) => src
    ? <a href={src} title={title} target="_blank" rel="noopener noreferrer">{alt || '图片链接'}</a>
    : <span title={title}>{alt || '图片链接'}</span>,
  pre: ({ children, className }) => <div className="tk-markdown-scroll tk-markdown-code" role="region" aria-label="代码块" tabIndex={0}>
    <pre className={className}>{children}</pre>
  </div>,
  table: ({ children }) => <div className="tk-markdown-scroll tk-markdown-table" role="region" aria-label="表格" tabIndex={0}>
    <table>{children}</table>
  </div>,
};

export function MessageBody({ text, className }: { text: string; className?: string }): React.ReactElement {
  return <div className={['tk-markdown', className].filter(Boolean).join(' ')}>
    <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml>{text}</Markdown>
  </div>;
}
