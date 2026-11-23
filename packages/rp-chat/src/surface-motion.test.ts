// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createSurfaceMotion } from './surface-motion.js';

const disposers: Array<() => void> = [];
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); document.body.replaceChildren(); });
function surface() {
  const element = document.createElement('div');
  document.body.append(element);
  const motion = createSurfaceMotion(element, 'menu');
  disposers.push(() => motion.dispose());
  return { element, motion };
}

describe('弹层动效的无 WAAPI 回退', () => {
  it('开关立即落到可读取的最终状态，并同步完成关闭而不等待计时器', () => {
    const { element, motion } = surface(), completed: string[] = [];
    // jsdom deliberately has no Element.animate. These assertions do not simulate animation frames.
    expect(typeof element.animate).toBe('undefined');
    motion.to(false, false, () => completed.push('closed'));
    expect(element.dataset.state).toBe('closed');
    expect(element.style.opacity).toBe('0');
    expect(completed).toEqual(['closed']);
    motion.to(true, false, () => completed.push('open'));
    expect(element.dataset.state).toBe('open');
    expect(element.style.opacity).toBe('1');
    expect(completed).toEqual(['closed', 'open']);
  });

  it('快速关开不留下延迟关闭，dispose 后调用和键盘事件不能再改状态或通知组件', async () => {
    const { element, motion } = surface(), completed: string[] = [];
    motion.to(true);
    motion.to(false, false, () => completed.push('closed'));
    motion.to(true, true, () => completed.push('reopened'));
    await Promise.resolve();
    expect(element.dataset.state).toBe('open');
    expect(completed).toEqual(['closed', 'reopened']);
    motion.dispose();
    motion.to(false, false, () => completed.push('after dispose'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
    expect(element.dataset.state).toBe('open');
    expect(completed).toEqual(['closed', 'reopened']);
  });
});
