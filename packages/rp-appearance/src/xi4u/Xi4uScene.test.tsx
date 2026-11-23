// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Xi4uScene } from './index.js';

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Xi4uScene failure recovery', () => {
  it('shows an offline still courtyard and the real WebGL failure with a usable retry', async () => {
    document.documentElement.style.setProperty('--scene-background', 'main-app');
    const view = render(<Xi4uScene season="autumn" scheme="dark" className="in-chat" />);
    // The real Three/vendor module loads on demand; wait for that work instead of a 1s DOM polling race.
    await act(async () => { await vi.dynamicImportSettled(); });
    const error = await screen.findByRole('alert');
    expect(error.textContent).toMatch(/WebGL|context/i);
    expect(screen.getByRole('img', { name: '秋日静态庭院' })).toBeTruthy();
    expect(view.container.querySelector('.in-chat')).toBeTruthy();
    expect(view.container.querySelector('svg')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '重试庭院' }));
    await act(async () => { await vi.dynamicImportSettled(); });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/WebGL|context/i));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(view.container.querySelectorAll('canvas')).toHaveLength(0);
    expect(document.documentElement.style.getPropertyValue('--scene-background')).toBe('main-app');
    view.rerender(<Xi4uScene season="winter" scheme="light" />);
    expect(screen.getByRole('img', { name: '冬日静态庭院' })).toBeTruthy();
    view.unmount();
    expect(document.documentElement.style.getPropertyValue('--scene-background')).toBe('main-app');
    document.documentElement.style.removeProperty('--scene-background');
  });
});
