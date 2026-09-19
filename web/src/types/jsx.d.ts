/**
 * Material Web components are custom elements: allow any tag/prop in JSX so
 * `<md-filled-button>` etc. type check instead of erroring.
 */
import type * as React from 'react';

type CustomElementProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  [key: string]: unknown;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      [name: string]: CustomElementProps;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [name: string]: CustomElementProps;
    }
  }
}
