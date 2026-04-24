import { createSignal, createEffect, Show } from 'solid-js';

interface NumberInputProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  unit?: string;
  error?: boolean;
  onChange: (value: number) => void;
  onValidate?: (value: number) => boolean; // 全局校验回调，返回 true 表示校验通过
}

export function NumberInput(props: NumberInputProps) {
  const [localValue, setLocalValue] = createSignal(String(props.value));
  const [localError, setLocalError] = createSignal(false);

  // 当外部 value 变化时更新本地值
  createEffect(() => {
    const externalValue = props.value;
    setLocalValue(String(externalValue));
    setLocalError(false);
  });

  const validateAndNotify = (inputValue: string) => {
    const num = props.integer
      ? parseInt(inputValue, 10)
      : parseFloat(inputValue);

    // 本地校验
    if (isNaN(num)) {
      setLocalError(true);
      // 不调用 onChange，保持父组件状态不变
      return false;
    }

    if (props.min !== undefined && num < props.min) {
      setLocalError(true);
      // 不调用 onChange，保持父组件状态不变
      return false;
    }

    if (props.max !== undefined && num > props.max) {
      setLocalError(true);
      // 不调用 onChange，保持父组件状态不变
      return false;
    }

    // 更新值
    props.onChange(num);

    // 全局校验
    if (props.onValidate) {
      const globalValid = props.onValidate(num);
      setLocalError(!globalValid);
      return globalValid;
    }

    setLocalError(false);
    return true;
  };

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    setLocalValue(target.value);
  };

  const handleChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    validateAndNotify(target.value);
  };

  const handleBlur = (e: Event) => {
    const target = e.target as HTMLInputElement;
    validateAndNotify(target.value);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLInputElement;
      validateAndNotify(target.value);
      target.blur();
    }
  };

  // 处理上下箭头点击
  const handleStepChange = (direction: 'up' | 'down') => {
    const step = props.step ?? (props.integer ? 1 : 0.1);
    const currentNum = props.integer
      ? parseInt(localValue(), 10)
      : parseFloat(localValue());

    if (isNaN(currentNum)) return;

    let newNum = direction === 'up' ? currentNum + step : currentNum - step;

    // 应用 min/max 限制
    if (props.min !== undefined && newNum < props.min) {
      newNum = props.min;
    }
    if (props.max !== undefined && newNum > props.max) {
      newNum = props.max;
    }

    const roundedNum = props.integer ? Math.round(newNum) : Math.round(newNum * 1000) / 1000;
    setLocalValue(String(roundedNum));
    validateAndNotify(String(roundedNum));
  };

  const hasError = () => localError() || props.error;

  return (
    <div class="flex flex-col space-y-1">
      <label class="text-xs text-gray-500 dark:text-gray-400" id={`${props.label}-label`}>
        {props.label}
      </label>
      <div class="relative">
        <input
          type="number"
          value={localValue()}
          min={props.min}
          max={props.max}
          step={props.step ?? (props.integer ? 1 : 0.1)}
          onInput={handleInput}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          aria-labelledby={`${props.label}-label`}
          aria-invalid={hasError()}
          aria-describedby={hasError() ? `${props.label}-error` : undefined}
          classList={{
            'w-full px-3 py-1.5 pr-16 text-sm bg-gray-100 dark:bg-gray-700 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors': true,
            'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white': !hasError(),
            'border-red-500 text-red-500': hasError(),
            // 隐藏原生箭头
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none': true,
          }}
        />
        {/* 上下箭头和单位 - 在输入框内部右侧 */}
        <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {/* 上下箭头 */}
          <div class="flex flex-col">
            <button
              type="button"
              onClick={() => handleStepChange('up')}
              aria-label={`增加 ${props.label}`}
              class="w-8 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 active:bg-gray-200 dark:active:bg-gray-600 rounded cursor-pointer touch-manipulation"
            >
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => handleStepChange('down')}
              aria-label={`减少 ${props.label}`}
              class="w-8 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 active:bg-gray-200 dark:active:bg-gray-600 rounded cursor-pointer touch-manipulation"
            >
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          {/* 单位 */}
          <Show when={props.unit}>
            <span class="text-xs text-gray-400 dark:text-gray-500 w-8 text-right" aria-hidden="true">
              {props.unit}
            </span>
          </Show>
          {/* 没有单位时占位，保持对齐 */}
          <Show when={!props.unit}>
            <span class="w-8" aria-hidden="true" />
          </Show>
        </div>
      </div>
    </div>
  );
}
