// NumberInput 组件测试：验证逻辑、边界值、错误状态

import { render, fireEvent } from '@solidjs/testing-library';
import { describe, it, expect, vi } from 'vitest';
import { NumberInput } from '../controls/NumberInput';

describe('NumberInput', () => {
  it('renders with initial value and label', () => {
    const onChange = vi.fn();
    const { container } = render(() => <NumberInput label="Stroke" value={10} onChange={onChange} />);
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('10');
    expect(container.textContent).toContain('Stroke');
  });

  it('calls onChange with valid number on blur', () => {
    const onChange = vi.fn();
    const { container } = render(() => <NumberInput label="Stroke" value={10} onChange={onChange} />);
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = '20';
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(20);
  });

  it('shows error for NaN input', () => {
    const onChange = vi.fn();
    const { container } = render(() => <NumberInput label="Stroke" value={10} onChange={onChange} />);
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = 'abc';
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('rejects value below min', () => {
    const onChange = vi.fn();
    const { container } = render(() => <NumberInput label="Stroke" value={5} min={1} onChange={onChange} />);
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = '0';
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('rejects value above max', () => {
    const onChange = vi.fn();
    const { container } = render(() => <NumberInput label="Stroke" value={5} max={100} onChange={onChange} />);
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = '200';
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('accepts value within min/max range', () => {
    const onChange = vi.fn();
    const { container } = render(() => <NumberInput label="Stroke" value={5} min={1} max={100} onChange={onChange} />);
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = '50';
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(50);
  });

  it('uses integer parsing when integer prop is set', () => {
    const onChange = vi.fn();
    const { container } = render(() => <NumberInput label="Points" value={360} integer onChange={onChange} />);
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = '100';
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('commits value via onChange before calling onValidate', () => {
    const onChange = vi.fn();
    const onValidate = vi.fn(() => false);
    const { container } = render(() => <NumberInput label="Stroke" value={10} onChange={onChange} onValidate={onValidate} />);
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = '15';
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(15);
    expect(onValidate).toHaveBeenCalledWith(15);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('displays external error state', () => {
    const onChange = vi.fn();
    const { container } = render(() => <NumberInput label="Stroke" value={10} error onChange={onChange} />);
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('renders unit text when provided', () => {
    const onChange = vi.fn();
    const { container } = render(() => <NumberInput label="Stroke" value={10} unit="mm" onChange={onChange} />);
    expect(container.textContent).toContain('mm');
  });
});