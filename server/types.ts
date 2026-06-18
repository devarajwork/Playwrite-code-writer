// Shared types for the Playwright Test Builder

export interface TestStep {
  id: string;
  type: StepType;
  selector: string;
  value: string;
  description: string;
  order: number;
  waitUntil?: string;
  optional?: boolean;
  fallbacks?: string[];
}

export type StepType =
  | 'navigate'
  | 'click'
  | 'fill'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'upload'
  | 'hover'
  | 'waitForSelector'
  | 'assertVisible'
  | 'assertText'
  | 'assertValue'
  | 'assertUrl'
  | 'screenshot'
  | 'press'
  | 'dblclick'
  | 'scrollTo'
  | 'waitForTimeout';

export interface ScannedElement {
  tagName: string;
  id: string;
  name: string;
  className: string;
  dataTestId: string;
  role: string;
  type: string;
  placeholder: string;
  text: string;
  ariaLabel: string;
  altText: string;
  title: string;
  href: string;
  selectors: SelectorSet;
}

export interface SelectorSet {
  byTestId: string;
  byRole: string;
  byLabel: string;
  byPlaceholder: string;
  byAltText: string;
  byTitle: string;
  byText: string;
  css: string;
  xpath: string;
  byId: string;
}

export interface GenerateRequest {
  testName: string;
  testDescription: string;
  steps: TestStep[];
  baseURL: string;
}

export interface ScanRequest {
  url: string;
}

export interface ScanResponse {
  url: string;
  title: string;
  elementCount: number;
  elements: ScannedElement[];
  timestamp: string;
  note?: string;
}
