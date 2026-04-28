import { language } from '../../i18n';

interface SelectOption {
  value: number;
  label: string;
  labelZh?: string;
}

interface SelectProps {
  label: string;
  value: number;
  options: SelectOption[];
  onChange: (value: number) => void;
  onValidate?: (value: number) => boolean;
}

export function Select(props: SelectProps) {
  const handleChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    const newValue = parseInt(target.value, 10);
    props.onChange(newValue);

    if (props.onValidate) {
      props.onValidate(newValue);
    }
  };

  const getOptionLabel = (option: SelectOption): string => {
    return language() === 'zh' && option.labelZh ? option.labelZh : option.label;
  };

  return (
    <div class="flex flex-col space-y-1">
      <label class="font-display text-xs uppercase tracking-wider text-on-surface-variant" id={`${props.label}-label`}>
        {props.label}
      </label>
      <select
        value={props.value}
        onChange={handleChange}
        aria-labelledby={`${props.label}-label`}
        class="w-full px-2 py-1.5 text-sm bg-surface-container border border-outline-variant rounded-md hover:border-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-on-surface font-display appearance-none cursor-pointer transition-colors"
      >
        {props.options.map((option) => (
          <option value={option.value} class="bg-surface-container-lowest">
            {getOptionLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}
