import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// recharts' ResponsiveContainer needs ResizeObserver, which jsdom doesn't provide.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

beforeEach(() => {
  // jsdom doesn't implement alert/confirm; the app uses both. Fresh mocks per test
  // so assertions like `expect(window.alert).toHaveBeenCalled()` work.
  vi.stubGlobal('alert', vi.fn());
  vi.stubGlobal('confirm', vi.fn(() => true));
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});
