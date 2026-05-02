import { params, setParams, displayOptions, setDisplayOptions, setParamsChanged, setParamsUpdated, runSimulation } from './core';
import { FollowerType } from '../../types';

// 保存配置到 localStorage
export function savePreset(name: string) {
  const preset = {
    params: params(),
    displayOptions: displayOptions(),
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(`camforge-preset-${name}`, JSON.stringify(preset));
}

// 加载配置从 localStorage
export function loadPreset(name: string): boolean {
  const stored = localStorage.getItem(`camforge-preset-${name}`);
  if (stored) {
    try {
      const preset = JSON.parse(stored);
      const p = preset.params;
      if (p.gamma === undefined) p.gamma = 0;
      if (p.flat_face_offset === undefined) p.flat_face_offset = 0;
      setParams(p);
      setDisplayOptions(preset.displayOptions);
      setParamsChanged(true);
      setParamsUpdated(true);
      runSimulation();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// 获取所有保存的配置名称
export function getSavedPresets(): string[] {
  const presets: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('camforge-preset-')) {
      presets.push(key.replace('camforge-preset-', ''));
    }
  }
  return presets;
}

// 删除配置
export function deletePreset(name: string) {
  localStorage.removeItem(`camforge-preset-${name}`);
}

// 导出当前配置为 JSON
export function generatePresetJSON(): string {
  const currentParams = params();
  const currentDisplay = displayOptions();
  const preset = {
    params: currentParams,
    displayOptions: currentDisplay,
    savedAt: new Date().toISOString(),
    version: '1.0.0'
  };
  return JSON.stringify(preset, null, 2);
}

// 从 JSON 字符串加载配置
export function loadPresetFromJSON(jsonString: string): { success: boolean; error?: string } {
  try {
    const preset = JSON.parse(jsonString);

    // 验证必要字段存在
    if (!preset.params) {
      return { success: false, error: '配置文件缺少 params 字段' };
    }

    // 验证 params 包含必要的参数
    const requiredKeys = ['delta_0', 'delta_01', 'delta_ret', 'delta_02', 'h', 'r_0', 'e', 'omega', 'r_r', 'n_points', 'alpha_threshold', 'tc_law', 'hc_law', 'sn', 'pz'];
    for (const key of requiredKeys) {
      if (!(key in preset.params)) {
        return { success: false, error: `配置文件缺少必要参数: ${key}` };
      }
    }

    // 验证数值参数类型和范围
    const p = preset.params;
    const numericFields: [string, number][] = [
      ['delta_0', p.delta_0], ['delta_01', p.delta_01], ['delta_ret', p.delta_ret], ['delta_02', p.delta_02],
      ['h', p.h], ['r_0', p.r_0], ['e', p.e], ['omega', p.omega], ['r_r', p.r_r], ['alpha_threshold', p.alpha_threshold],
    ];
    for (const [name, val] of numericFields) {
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        return { success: false, error: `参数 ${name} 必须为有限数值，得到: ${val}` };
      }
    }
    if (typeof p.n_points !== 'number' || !Number.isInteger(p.n_points) || p.n_points < 36) {
      return { success: false, error: `参数 n_points 必须为 ≥36 的整数，得到: ${p.n_points}` };
    }
    if (![1,2,3,4,5,6].includes(p.tc_law)) {
      return { success: false, error: `参数 tc_law 必须为 1-6，得到: ${p.tc_law}` };
    }
    if (![1,2,3,4,5,6].includes(p.hc_law)) {
      return { success: false, error: `参数 hc_law 必须为 1-6，得到: ${p.hc_law}` };
    }
    if (![1, -1].includes(p.sn)) {
      return { success: false, error: `参数 sn 必须为 +1 或 -1，得到: ${p.sn}` };
    }
    if (![1, -1].includes(p.pz)) {
      return { success: false, error: `参数 pz 必须为 +1 或 -1，得到: ${p.pz}` };
    }

    // 向后兼容：为旧预设设置新字段默认值
    if (p.follower_type === undefined) {
      p.follower_type = FollowerType.TranslatingRoller;
    }
    if (![1,2,3,4,5].includes(p.follower_type)) {
      return { success: false, error: `参数 follower_type 必须为 1-5，得到: ${p.follower_type}` };
    }
    if (p.arm_length === undefined) p.arm_length = 80.0;
    if (p.pivot_distance === undefined) p.pivot_distance = 120.0;
    if (p.initial_angle === undefined) p.initial_angle = 0.0;
    if (p.gamma === undefined) p.gamma = 0;
    if (p.flat_face_offset === undefined) p.flat_face_offset = 0;

    // 摆动从动件参数验证
    const isOscillating = p.follower_type === FollowerType.OscillatingRoller || p.follower_type === FollowerType.OscillatingFlatFaced;
    if (isOscillating) {
      if (typeof p.arm_length !== 'number' || p.arm_length <= 0) {
        return { success: false, error: `摆动从动件臂长必须为正数，得到: ${p.arm_length}` };
      }
      if (typeof p.pivot_distance !== 'number' || p.pivot_distance <= 0) {
        return { success: false, error: `枢轴距离必须为正数，得到: ${p.pivot_distance}` };
      }
      if (p.arm_length + p.h > p.pivot_distance) {
        return { success: false, error: `臂长 + 行程必须 ≤ 枢轴距离` };
      }
      if (Math.abs(p.e) > Number.EPSILON) {
        return { success: false, error: `摆动从动件偏距必须为 0` };
      }
      if (Math.abs(p.initial_angle) < Number.EPSILON) {
        return { success: false, error: `摆动从动件初始角必须为非零值（0 会导致压力角计算奇点）` };
      }
    }

    // 应用参数
    setParams(preset.params);

    // 如果有显示选项，也应用
    if (preset.displayOptions) {
      setDisplayOptions(preset.displayOptions);
    }

    setParamsChanged(true);
    setParamsUpdated(true);
    runSimulation();
    return { success: true };
  } catch {
    return { success: false, error: 'JSON 解析失败: 文件格式不正确，请检查是否为有效的 CamForge 预设文件' };
  }
}
