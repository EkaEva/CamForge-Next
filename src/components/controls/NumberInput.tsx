import { createSignal, createEffect, Show } from 'solid-js';
import { Icon } from '../ui/Icon';

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
  onValidate?: (value: number) => boolean;
}

export function NumberInput(props: NumberInputProps) {
  const [localValue, setLocalValue] = createSignal(String(props.value));
  const [localError, setLocalError] = createSignal(false);

  createEffect(() => {
    const externalValue = props.value;
    setLocalValue(String(externalValue));
    setLocalError(false);
  });

  const validateAndNotify = (inputValue: string) => {
    const num = props.integer
      ? parseInt(inputValue, 10)
      : parseFloat(inputValue);

    if (isNaN(num)) {
      setLocalError(true);
      return false;
    }

    if (props.min !== undefined && num < props.min) {
      setLocalError(true);
      return false;
    }

    if (props.max !== undefined && num > props.max) {
      setLocalError(true);
      return false;
    }

    props.onChange(num);

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

  const handleStepChange = (direction: 'up' | 'down') => {
    const step = props.step ?? (props.integer ? 1 : 0.1);
    const currentNum = props.integer
      ? parseInt(localValue(), 10)
      : parseFloat(localValue());

    if (isNaN(currentNum)) return;

    let newNum = direction === 'up' ? currentNum + step : currentNum - step;

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
      <label class="text-xs overflow-hidden text-ellipsis whitespace-nowrap" id={`${props.label}-label`}
        classList={{
          'text-on-surface-variant': !hasError(),
          'text-error': hasError(),
        }}
      >
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
            'w-full px-2 py-1.5 pr-16 text-sm bg-surface-container border rounded-md focus:outline-none transition-colors font-display': true,
            'border-outline-variant text-on-surface hover:border-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary': !hasError(),
            'border-error text-error focus:border-error focus:ring-1 focus:ring-error': hasError(),
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none': true,
          }}
        />
        <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          <div class="flex flex-col">
            <button
              type="button"
              onClick={() => handleStepChange('up')}
              aria-label={`增加 ${props.label}`}
              class="w-8 h-5 flex items-center justify-center text-on-surface-variant hover:text-on-surface active:bg-surface-container-high rounded cursor-pointer touch-manipulation"
            >
              <Icon name="expand_less" size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleStepChange('down')}
              aria-label={`减少 ${props.label}`}
              class="w-8 h-5 flex items-center justify-center text-on-surface-variant hover:text-on-surface active:bg-surface-container-high rounded cursor-pointer touch-manipulation"
            >
              <Icon name="expand_more" size={14} />
            </button>
          </div>
          <Show when={props.unit}>
            <span class="text-xs text-on-surface-variant font-display w-8 text-right" aria-hidden="true">
              {props.unit}
            </span>
          </Show>
          <Show when={!props.unit}>
            <span class="w-8" aria-hidden="true" />
          </Show>
        </div>
      </div>
    </div>
  );
}
