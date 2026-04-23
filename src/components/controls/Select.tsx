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
  onValidate?: (value: number) => boolean; // 全局校验回调，返回 true 表示校验通过
}

export function Select(props: SelectProps) {
  const handleChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    const newValue = parseInt(target.value, 10);
    props.onChange(newValue);

    // 选择后触发校验和模拟
    if (props.onValidate) {
      props.onValidate(newValue);
    }
  };

  // 使用函数形式，每次渲染时重新计算
  const getOptionLabel = (option: SelectOption): string => {
    return language() === 'zh' && option.labelZh ? option.labelZh : option.label;
  };

  return (
    <div class="flex flex-col space-y-1">
      <label class="text-xs text-gray-500 dark:text-gray-400" id={`${props.label}-label`}>
        {props.label}
      </label>
      <select
        value={props.value}
        onChange={handleChange}
        aria-labelledby={`${props.label}-label`}
        class="w-full px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white appearance-none cursor-pointer"
      >
        {props.options.map((option) => (
          <option value={option.value} class="bg-white dark:bg-gray-800">
            {getOptionLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}
