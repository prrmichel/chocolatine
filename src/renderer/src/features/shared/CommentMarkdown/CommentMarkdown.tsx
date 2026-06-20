import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './CommentMarkdown.module.css';

interface CommentMarkdownProps {
  content: string;
  className?: string;
  mode?: 'markdown' | 'html' | 'auto';
  transformHtml?: (value: string) => string;
}

const looksLikeHtml = (value: string): boolean => /<\/?[a-z][\s\S]*>/i.test(value);

export default function CommentMarkdown({
  content,
  className,
  mode = 'markdown',
  transformHtml
}: CommentMarkdownProps) {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  const resolvedClassName = className
    ? `${styles.commentMarkdown} ${className}`
    : styles.commentMarkdown;

  const renderAsHtml = mode === 'html' || (mode === 'auto' && looksLikeHtml(trimmed));
  if (renderAsHtml) {
    const html = transformHtml ? transformHtml(trimmed) : trimmed;
    return <div className={resolvedClassName} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <div className={resolvedClassName}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer" />
        }}
      >
        {trimmed}
      </ReactMarkdown>
    </div>
  );
}
