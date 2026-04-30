/**
 * CSV 导出模块
 *
 * 生成 CSV 格式的凸轮数据
 */

import type { SimulationData, CamParams } from '../types';

/** Escape a CSV cell value to prevent formula injection and handle special characters */
function escapeCSVCell(value: string): string {
  // Prevent formula injection in Excel (cells starting with =, +, -, @, tab, CR)
  const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerousPrefixes.some(p => value.startsWith(p))) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  // Quote cells containing commas, quotes, or newlines
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * 生成 CSV 格式内容
 * @param data 模拟数据
 * @param params 凸轮参数
 * @param lang 语言 ('zh' | 'en')
 * @returns CSV 文件内容字符串
 */
export function generateCSV(data: SimulationData, params: CamParams, lang: string): string {
  if (!data) return '';

  const lines: string[] = [];

  // Header row - 根据是否有滚子决定列数
  let headers: string;
  if (params.r_r > 0) {
    headers = lang === 'zh'
      ? '转角 δ (°),向径 R (mm),推杆位移 s (mm),推杆速度 v (mm/s),推杆加速度 a (mm/s²),理论曲率半径 ρ (mm),实际曲率半径 ρₐ (mm),压力角 α (°)'
      : 'Angle δ (°),Radius R (mm),Displacement s (mm),Velocity v (mm/s),Acceleration a (mm/s²),Theory ρ (mm),Actual ρₐ (mm),Pressure Angle α (°)';
  } else {
    headers = lang === 'zh'
      ? '转角 δ (°),向径 R (mm),推杆位移 s (mm),推杆速度 v (mm/s),推杆加速度 a (mm/s²),曲率半径 ρ (mm),压力角 α (°)'
      : 'Angle δ (°),Radius R (mm),Displacement s (mm),Velocity v (mm/s),Acceleration a (mm/s²),Curvature ρ (mm),Pressure Angle α (°)';
  }
  lines.push(headers);

  // Data rows
  for (let i = 0; i < data.delta_deg.length; i++) {
    const r = Math.sqrt(data.x[i] ** 2 + data.y[i] ** 2);
    const rho = isFinite(data.rho[i]) ? Math.abs(data.rho[i]).toFixed(4) : '';
    const rhoActual = data.rho_actual && isFinite(data.rho_actual[i]) ? Math.abs(data.rho_actual[i]).toFixed(4) : '';

    if (params.r_r > 0) {
      lines.push([
        data.delta_deg[i].toFixed(2),
        r.toFixed(4),
        data.s[i].toFixed(4),
        data.v[i].toFixed(4),
        data.a[i].toFixed(4),
        rho,
        rhoActual,
        data.alpha_all[i].toFixed(4)
      ].map(escapeCSVCell).join(','));
    } else {
      lines.push([
        data.delta_deg[i].toFixed(2),
        r.toFixed(4),
        data.s[i].toFixed(4),
        data.v[i].toFixed(4),
        data.a[i].toFixed(4),
        rho,
        data.alpha_all[i].toFixed(4)
      ].map(escapeCSVCell).join(','));
    }
  }

  return lines.join('\n');
}
