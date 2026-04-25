import { Show, createSignal, onMount } from 'solid-js';
import { NumberInput, Select, Toggle } from '../controls';
import { params, displayOptions, isLoading, updateParam, updateDisplayOption, runSimulation, savePreset, loadPreset, getSavedPresets, deletePreset, validateParams, setSimulationData, setLastRunTime, setParamsChanged, randomizeParams, loadPresetFromJSON, setDisplayOptions, setParamsUpdated } from '../../stores/simulation';
import { t } from '../../i18n';
import { motionLawOptions, defaultParams, defaultDisplayOptions } from '../../constants';

// 旋向选项
const rotationOptions = [
  { value: 1, label: 'Clockwise', labelZh: '顺时针' },
  { value: -1, label: 'Counter-clockwise', labelZh: '逆时针' },
];

interface SidebarProps {
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar(props: SidebarProps) {
  const [presets, setPresets] = createSignal<string[]>([]);
  const [presetName, setPresetName] = createSignal('');
  const [loadError, setLoadError] = createSignal<string | null>(null);
  let fileInputRef: HTMLInputElement | undefined;

  onMount(() => {
    setPresets(getSavedPresets());
  });

  // 校验并运行模拟
  const validateAndRun = (): boolean => {
    const errors = validateParams(params()).errors;
    if (errors.length === 0) {
      setParamsUpdated(true);
      runSimulation();
      return true;
    }
    return false;
  };

  const handleRunSimulation = () => {
    setParamsUpdated(true);
    runSimulation();
  };

  const handleReset = () => {
    Object.entries(defaultParams).forEach(([key, value]) => {
      updateParam(key as keyof typeof defaultParams, value as never);
    });
    setDisplayOptions(defaultDisplayOptions);
    setSimulationData(null);
    setLastRunTime(null);
    setParamsChanged(false);
  };

  const handleRandomize = () => {
    randomizeParams();
  };

  const handleSavePreset = () => {
    const name = presetName().trim();
    if (name) {
      savePreset(name);
      setPresets(getSavedPresets());
      setPresetName('');
    }
  };

  const handleLoadPreset = (name: string) => {
    loadPreset(name);
  };

  const handleDeletePreset = (name: string) => {
    deletePreset(name);
    setPresets(getSavedPresets());
  };

  const handleLoadFromFile = () => {
    setLoadError(null);
    fileInputRef?.click();
  };

  const handleFileInputChange = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = loadPresetFromJSON(content);
      if (result.success) {
        setLoadError(null);
      } else {
        setLoadError(result.error || '加载失败');
        setTimeout(() => setLoadError(null), 3000);
      }
    };
    reader.onerror = () => {
      setLoadError('文件读取失败');
      setTimeout(() => setLoadError(null), 3000);
    };
    reader.readAsText(file);
    target.value = '';
  };

  // 获取校验错误数量
  const errorCount = () => validateParams(params()).errors.length;

  // 计算侧边栏类名
  const sidebarClass = () => {
    if (props.isMobile) {
      return `h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        ${props.isOpen ? 'translate-x-0' : '-translate-x-full'}`;
    }
    return 'w-80 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col';
  };

  return (
    <aside class={sidebarClass()} style={props.isMobile ? { 'padding-top': 'env(safe-area-inset-top)' } : undefined}>
      {/* Logo */}
      <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center gap-3">
        <a
          href="https://github.com/EkaEva/CamForge-Next"
          target="_blank"
          rel="noopener noreferrer"
          class="block cursor-pointer"
        >
          <img
            src="/logo.png"
            alt="CamForge"
            width="40"
            height="40"
            decoding="async"
            class="h-10 w-auto transition-transform duration-200 hover:scale-110 hover:rotate-6 active:scale-95 active:rotate-0"
          />
        </a>
        <div>
          <h1 class="text-lg font-bold text-gray-900 dark:text-white tracking-wide">
            CamForge
          </h1>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {t().app.tagline}
          </p>
        </div>
      </div>

      {/* 可滚动内容区域 */}
      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* 运动参数 - 主模块 */}
        <div class="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* 左侧蓝色色条 */}
          <div class="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500" />
          <div class="pl-3 pr-3 py-3">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-white mb-3">
              {t().sidebar.group.motion}
            </h3>
            <div class="space-y-2.5">
              <NumberInput
                label={t().sidebar.label.delta_0}
                value={params().delta_0}
                min={1} max={359} integer
                unit={t().sidebar.unit.deg}
                onChange={(v) => updateParam('delta_0', v)}
                onValidate={validateAndRun}
              />
              <NumberInput
                label={t().sidebar.label.delta_01}
                value={params().delta_01}
                min={0} max={359} integer
                unit={t().sidebar.unit.deg}
                onChange={(v) => updateParam('delta_01', v)}
                onValidate={validateAndRun}
              />
              <NumberInput
                label={t().sidebar.label.delta_ret}
                value={params().delta_ret}
                min={1} max={359} integer
                unit={t().sidebar.unit.deg}
                onChange={(v) => updateParam('delta_ret', v)}
                onValidate={validateAndRun}
              />
              <NumberInput
                label={t().sidebar.label.delta_02}
                value={params().delta_02}
                min={0} max={359} integer
                unit={t().sidebar.unit.deg}
                onChange={(v) => updateParam('delta_02', v)}
                onValidate={validateAndRun}
              />
              <Select
                label={t().sidebar.label.tc_law}
                value={params().tc_law}
                options={motionLawOptions}
                onChange={(v) => updateParam('tc_law', v)}
                onValidate={validateAndRun}
              />
              <Select
                label={t().sidebar.label.hc_law}
                value={params().hc_law}
                options={motionLawOptions}
                onChange={(v) => updateParam('hc_law', v)}
                onValidate={validateAndRun}
              />
              <Select
                label={t().sidebar.label.sn}
                value={params().sn}
                options={rotationOptions}
                onChange={(v) => updateParam('sn', v)}
                onValidate={validateAndRun}
              />
            </div>
          </div>
        </div>

        {/* 几何参数 - 主模块 */}
        <div class="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* 左侧绿色色条 */}
          <div class="absolute left-0 top-0 bottom-0 w-0.5 bg-green-500" />
          <div class="pl-3 pr-3 py-3">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-white mb-3">
              {t().sidebar.group.geometry}
            </h3>
            <div class="space-y-2.5">
              <NumberInput
                label={t().sidebar.label.h}
                value={params().h}
                min={0.1} step={0.5}
                unit={t().sidebar.unit.mm}
                onChange={(v) => updateParam('h', v)}
                onValidate={validateAndRun}
              />
              <NumberInput
                label={t().sidebar.label.e}
                value={params().e}
                min={-50} step={0.5}
                unit={t().sidebar.unit.mm}
                onChange={(v) => updateParam('e', v)}
                onValidate={validateAndRun}
              />
              <NumberInput
                label={t().sidebar.label.r_0}
                value={params().r_0}
                min={1} step={1}
                unit={t().sidebar.unit.mm}
                onChange={(v) => updateParam('r_0', v)}
                onValidate={validateAndRun}
              />
              <NumberInput
                label={t().sidebar.label.r_r}
                value={params().r_r}
                min={0} step={0.5}
                unit={t().sidebar.unit.mm}
                onChange={(v) => updateParam('r_r', v)}
                onValidate={validateAndRun}
              />
            </div>
          </div>
        </div>

        {/* 仿真设置 - 次模块 */}
        <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
            {t().sidebar.group.simulation}
          </h3>
          <div class="space-y-2.5">
            <NumberInput
              label={t().sidebar.label.omega}
              value={params().omega}
              min={0.1} step={0.1}
              unit={t().sidebar.unit.rad_s}
              onChange={(v) => updateParam('omega', v)}
              onValidate={validateAndRun}
            />
            <NumberInput
              label={t().sidebar.label.n_points}
              value={params().n_points}
              min={36} max={720} integer
              onChange={(v) => updateParam('n_points', v)}
              onValidate={validateAndRun}
            />
            <NumberInput
              label={t().sidebar.label.alpha_threshold}
              value={params().alpha_threshold}
              min={10} max={45} step={1}
              unit={t().sidebar.unit.deg}
              onChange={(v) => updateParam('alpha_threshold', v)}
              onValidate={validateAndRun}
            />
          </div>
        </div>

        {/* 显示选项 - 次模块 */}
        <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
            {t().sidebar.group.display}
          </h3>
          <div class="grid grid-cols-2 gap-x-4 gap-y-2">
            <Toggle
              label={t().sidebar.cb.tangent}
              checked={() => displayOptions().showTangent}
              onChange={(v) => updateDisplayOption('showTangent', v)}
            />
            <Toggle
              label={t().sidebar.cb.normal}
              checked={() => displayOptions().showNormal}
              onChange={(v) => updateDisplayOption('showNormal', v)}
            />
            <Toggle
              label={t().sidebar.cb.baseCircle}
              checked={() => displayOptions().showBaseCircle}
              onChange={(v) => updateDisplayOption('showBaseCircle', v)}
            />
            <Toggle
              label={t().sidebar.cb.nodes}
              checked={() => displayOptions().showNodes}
              onChange={(v) => updateDisplayOption('showNodes', v)}
            />
            <Toggle
              label={t().sidebar.cb.offsetCircle}
              checked={() => displayOptions().showOffsetCircle}
              onChange={(v) => updateDisplayOption('showOffsetCircle', v)}
            />
            <Toggle
              label={t().sidebar.cb.centerLine}
              checked={() => displayOptions().showCenterLine}
              onChange={(v) => updateDisplayOption('showCenterLine', v)}
            />
            <Toggle
              label={t().sidebar.cb.upperLimit}
              checked={() => displayOptions().showUpperLimit}
              onChange={(v) => updateDisplayOption('showUpperLimit', v)}
            />
            <Toggle
              label={t().sidebar.cb.lowerLimit}
              checked={() => displayOptions().showLowerLimit}
              onChange={(v) => updateDisplayOption('showLowerLimit', v)}
            />
            <Toggle
              label={t().sidebar.cb.pressureArc}
              checked={() => displayOptions().showPressureArc}
              onChange={(v) => updateDisplayOption('showPressureArc', v)}
            />
            <Toggle
              label={t().sidebar.cb.boundaries}
              checked={() => displayOptions().showBoundaries}
              onChange={(v) => updateDisplayOption('showBoundaries', v)}
            />
          </div>
        </div>

        {/* 配置管理 - 次模块 */}
        <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
            {t().sidebar.group.preset}
          </h3>
          <div class="space-y-2">
            <div class="flex gap-2">
              <input
                type="text"
                placeholder={t().sidebar.preset.name}
                value={presetName()}
                onInput={(e) => setPresetName(e.currentTarget.value)}
                class="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!presetName().trim()}
                class="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:dark:bg-gray-600 text-white rounded-md transition-colors whitespace-nowrap"
              >
                {t().sidebar.btn.save}
              </button>
            </div>
            <div class="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileInputChange}
                class="hidden"
              />
              <button
                type="button"
                onClick={handleLoadFromFile}
                class="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md border border-gray-300 dark:border-gray-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {t().sidebar.btn.loadFromFile}
              </button>
            </div>
            <Show when={loadError()}>
              <div class="text-xs text-red-500">
                {loadError()}
              </div>
            </Show>
            <Show when={presets().length > 0}>
              <div class="space-y-1">
                {presets().map((name) => (
                  <div class="flex items-center justify-between py-1 px-2 bg-white dark:bg-gray-700/50 rounded-md">
                    <span class="text-sm text-gray-700 dark:text-gray-300">{name}</span>
                    <div class="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadPreset(name)}
                        class="text-xs text-blue-500 hover:text-blue-600"
                      >
                        {t().sidebar.btn.load}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePreset(name)}
                        class="text-xs text-red-500 hover:text-red-600"
                      >
                        {t().sidebar.btn.delete}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* 固定底部操作栏 */}
      <div class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-5 py-4 flex-shrink-0" style={{ 'padding-bottom': 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div class="flex gap-3">
          {/* 运行按钮 */}
          <button
            type="button"
            onClick={handleRunSimulation}
            disabled={isLoading() || errorCount() > 0}
            class="flex-1 px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-300 disabled:dark:bg-gray-600 text-white rounded-lg transition-colors duration-150 shadow-sm hover:shadow-md disabled:shadow-none"
          >
            {t().sidebar.btn.run}
          </button>
          {/* 随机按钮 */}
          <button
            type="button"
            onClick={handleRandomize}
            class="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 transition-colors duration-150 shadow-sm hover:shadow-md"
          >
            {t().sidebar.btn.random}
          </button>
          {/* 重置按钮 */}
          <button
            type="button"
            onClick={handleReset}
            class="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 transition-colors duration-150 shadow-sm hover:shadow-md"
          >
            {t().sidebar.btn.reset}
          </button>
        </div>
      </div>
    </aside>
  );
}
