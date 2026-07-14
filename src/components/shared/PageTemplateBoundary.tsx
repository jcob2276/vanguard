import type { ReactNode } from 'react';

export type PageTemplateKind = 'list' | 'grid' | 'dashboard' | 'timeline';

export interface PageTemplateBoundaryProps {
  kind: PageTemplateKind;
  children: ReactNode;
}

/** Route-level design contract. `display: contents` preserves existing layout while
 * every descendant inherits the selected template's density and geometry tokens. */
export function PageTemplateBoundary({ kind, children }: PageTemplateBoundaryProps) {
  return <div className={`contents page-template-${kind}`} data-page-template={kind}>{children}</div>;
}

export default PageTemplateBoundary;
