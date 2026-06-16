/**
 * File-type icon resolution — Material Icon Theme-inspired colors + shapes.
 * Returns a <svg> React element sized to the requested size (default 16).
 */


interface IconDef {
  bg: string;   // background / primary color
  fg: string;   // text / symbol color
  label: string; // short label shown inside
}

const EXT_MAP: Record<string, IconDef> = {
  // TypeScript
  ts:    { bg: '#3178c6', fg: '#fff', label: 'TS' },
  tsx:   { bg: '#3178c6', fg: '#fff', label: 'TSX' },
  // JavaScript
  js:    { bg: '#f7df1e', fg: '#222', label: 'JS' },
  jsx:   { bg: '#f7df1e', fg: '#222', label: 'JSX' },
  mjs:   { bg: '#f7df1e', fg: '#222', label: 'MJS' },
  cjs:   { bg: '#f7df1e', fg: '#222', label: 'CJS' },
  // C#
  cs:    { bg: '#9b4f96', fg: '#fff', label: 'C#' },
  // C / C++
  c:     { bg: '#00599c', fg: '#fff', label: 'C' },
  cpp:   { bg: '#00599c', fg: '#fff', label: 'C++' },
  h:     { bg: '#6494b7', fg: '#fff', label: 'H' },
  hpp:   { bg: '#6494b7', fg: '#fff', label: 'H++' },
  // Razor
  cshtml:{ bg: '#512bd4', fg: '#fff', label: '.NET' },
  razor: { bg: '#512bd4', fg: '#fff', label: 'RZR' },
  // CSS / SCSS
  css:   { bg: '#264de4', fg: '#fff', label: 'CSS' },
  scss:  { bg: '#cc6699', fg: '#fff', label: 'SCSS' },
  sass:  { bg: '#cc6699', fg: '#fff', label: 'SASS' },
  less:  { bg: '#1d365d', fg: '#fff', label: 'LESS' },
  // HTML
  html:  { bg: '#e34f26', fg: '#fff', label: 'HTM' },
  htm:   { bg: '#e34f26', fg: '#fff', label: 'HTM' },
  // JSON / YAML / TOML / XML
  json:  { bg: '#fbc02d', fg: '#222', label: '{}' },
  jsonc: { bg: '#fbc02d', fg: '#222', label: '{}' },
  yaml:  { bg: '#cc1018', fg: '#fff', label: 'YML' },
  yml:   { bg: '#cc1018', fg: '#fff', label: 'YML' },
  toml:  { bg: '#9c4221', fg: '#fff', label: 'TOM' },
  xml:   { bg: '#f97316', fg: '#fff', label: 'XML' },
  // Markdown / Text
  md:    { bg: '#519aba', fg: '#fff', label: 'MD' },
  txt:   { bg: '#78909c', fg: '#fff', label: 'TXT' },
  // SQL
  sql:   { bg: '#e8834d', fg: '#fff', label: 'SQL' },
  // Python
  py:    { bg: '#3572a5', fg: '#fff', label: 'PY' },
  // Java / Kotlin
  java:  { bg: '#b07219', fg: '#fff', label: 'JV' },
  kt:    { bg: '#7f52ff', fg: '#fff', label: 'KT' },
  // Swift
  swift: { bg: '#f05138', fg: '#fff', label: 'SWT' },
  // Go
  go:    { bg: '#00acd7', fg: '#fff', label: 'GO' },
  // Rust
  rs:    { bg: '#dea584', fg: '#222', label: 'RS' },
  // Ruby
  rb:    { bg: '#701516', fg: '#fff', label: 'RB' },
  // PHP
  php:   { bg: '#4f5d95', fg: '#fff', label: 'PHP' },
  // Shell
  sh:    { bg: '#4eaa25', fg: '#fff', label: 'SH' },
  bash:  { bg: '#4eaa25', fg: '#fff', label: 'SH' },
  ps1:   { bg: '#012456', fg: '#fff', label: 'PS' },
  // Config
  env:   { bg: '#ecd53f', fg: '#333', label: 'ENV' },
  // Images
  png:   { bg: '#9c27b0', fg: '#fff', label: 'PNG' },
  jpg:   { bg: '#9c27b0', fg: '#fff', label: 'JPG' },
  jpeg:  { bg: '#9c27b0', fg: '#fff', label: 'JPG' },
  gif:   { bg: '#9c27b0', fg: '#fff', label: 'GIF' },
  svg:   { bg: '#ffb13b', fg: '#222', label: 'SVG' },
  ico:   { bg: '#9c27b0', fg: '#fff', label: 'ICO' },
};

/** Detect if the file is an Angular file by name patterns */
function getAngularSuffix(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.component.ts') || lower.endsWith('.component.html') || lower.endsWith('.component.scss') || lower.endsWith('.component.css')) return 'COMP';
  if (lower.endsWith('.service.ts')) return 'SVC';
  if (lower.endsWith('.module.ts')) return 'MOD';
  if (lower.endsWith('.pipe.ts')) return 'PIPE';
  if (lower.endsWith('.directive.ts')) return 'DIR';
  if (lower.endsWith('.guard.ts')) return 'GRD';
  if (lower.endsWith('.interceptor.ts')) return 'INT';
  if (lower.endsWith('.resolver.ts')) return 'RES';
  if (lower.endsWith('.spec.ts')) return 'TEST';
  return null;
}

function getExtension(name: string): string {
  const parts = name.split('.');
  if (parts.length < 2) return '';
  // Handle double extensions like .component.ts
  if (parts.length >= 3) {
    const doubleExt = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`.toLowerCase();
    if (doubleExt === 'component.ts' || doubleExt === 'component.html') {
      return parts[parts.length - 1].toLowerCase();
    }
  }
  return parts[parts.length - 1].toLowerCase();
}

/** Returns a highlight.js language identifier for a given file path */
export function getLanguageFromPath(filePath: string): string {
  const name = filePath.split('/').pop()?.split('\\').pop() ?? filePath;
  const ext = getExtension(name);
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    cs: 'csharp', cshtml: 'xml', razor: 'xml',
    css: 'css', scss: 'scss', sass: 'scss', less: 'less',
    html: 'xml', htm: 'xml', xml: 'xml',
    json: 'json', jsonc: 'json',
    yaml: 'yaml', yml: 'yaml',
    toml: 'ini',
    md: 'markdown',
    sql: 'sql',
    py: 'python',
    java: 'java',
    kt: 'kotlin',
    go: 'go',
    rs: 'rust',
    rb: 'ruby',
    php: 'php',
    sh: 'bash', bash: 'bash',
    ps1: 'powershell',
    cpp: 'cpp', c: 'c', h: 'cpp',
  };
  return langMap[ext] ?? 'plaintext';
}

interface FileIconProps {
  name: string;
  size?: number;
}

export function FileIcon({ name, size = 16 }: FileIconProps) {
  const angularSuffix = getAngularSuffix(name);
  const ext = getExtension(name);

  let def: IconDef;
  let label: string;

  if (angularSuffix) {
    // Angular file — red background, white text, Angular-inspired
    def = { bg: '#dd0031', fg: '#fff', label: angularSuffix };
    label = angularSuffix;
  } else {
    def = EXT_MAP[ext] ?? { bg: '#607d8b', fg: '#fff', label: (ext.toUpperCase().slice(0, 3) || 'FILE') };
    label = def.label;
  }

  const r = 3;
  const fontSize = label.length > 3 ? size * 0.28 : size * 0.32;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
    >
      <rect x="1" y="1" width="14" height="14" rx={r} ry={r} fill={def.bg} />
      <text
        x="8"
        y="8"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily="'Segoe UI', system-ui, sans-serif"
        fontWeight="700"
        fill={def.fg}
        letterSpacing="-0.3"
      >
        {label}
      </text>
    </svg>
  );
}

export function FolderIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path d="M1 4a1 1 0 0 1 1-1h4.293l1.707 1.707H14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4z" fill="#dcb862" />
      <path d="M1 5.5h14v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5.5z" fill="#e8c96c" />
    </svg>
  );
}
