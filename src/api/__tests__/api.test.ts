import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpApi } from '../http';
import { TauriApi } from '../tauri';
import type { CamParams } from '../../types';

const mockParams: CamParams = {
  delta_0: 90,
  delta_01: 60,
  delta_ret: 120,
  delta_02: 90,
  h: 10,
  r_0: 40,
  e: 5,
  omega: 1,
  r_r: 10,
  n_points: 360,
  alpha_threshold: 30,
  tc_law: 5,
  hc_law: 6,
  sn: 1,
  pz: 1,
  follower_type: 2,
  arm_length: 80,
  pivot_distance: 120,
  initial_angle: 30,
  gamma: 0,
  flat_face_offset: 0,
};

describe('HttpApi', () => {
  let api: HttpApi;

  beforeEach(() => {
    api = new HttpApi('http://localhost:3000');
    vi.restoreAllMocks();
  });

  it('should POST to /api/simulate on runSimulation', async () => {
    const mockData = { s: [0], v: [0], a: [0] };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const result = await api.runSimulation(mockParams);
    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params: mockParams }),
    });
    expect(result).toEqual(mockData);
  });

  it('should throw on non-OK response from runSimulation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Bad params' }),
    } as Response);

    await expect(api.runSimulation(mockParams)).rejects.toThrow('Bad params');
  });

  it('should throw "Unknown error" when error body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    } as Response);

    await expect(api.runSimulation(mockParams)).rejects.toThrow('Unknown error');
  });

  it('should POST to /api/export/dxf on exportDxf', async () => {
    const mockBlob = new Blob(['dxf content'], { type: 'application/octet-stream' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    } as Response);

    const result = await api.exportDxf(mockParams, true);
    expect(result).toBe(mockBlob);
  });

  it('should throw on non-OK response from exportDxf', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Export failed' }),
    } as Response);

    await expect(api.exportDxf(mockParams)).rejects.toThrow('Export failed');
  });

  it('should POST to /api/export/csv on exportCsv', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('delta,s\n0,0'),
    } as Response);

    const result = await api.exportCsv(mockParams, 'en');
    expect(result).toBe('delta,s\n0,0');
  });

  it('should throw on non-OK response from exportCsv', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Invalid lang' }),
    } as Response);

    await expect(api.exportCsv(mockParams, 'fr')).rejects.toThrow('Invalid lang');
  });

  it('should throw on exportSvg (not supported)', async () => {
    await expect(api.exportSvg(mockParams)).rejects.toThrow('SVG export requires frontend');
  });

  it('should throw on exportExcel (not supported)', async () => {
    await expect(api.exportExcel(mockParams)).rejects.toThrow('Excel export requires frontend');
  });

  it('should throw on exportGif (not supported)', async () => {
    await expect(api.exportGif(mockParams)).rejects.toThrow('GIF export requires frontend');
  });

  it('should GET /health on healthCheck', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', version: '0.4.14' }),
    } as Response);

    const result = await api.healthCheck();
    expect(result).toEqual({ status: 'ok', version: '0.4.14' });
  });
});

describe('TauriApi', () => {
  let api: TauriApi;

  beforeEach(() => {
    api = new TauriApi();
  });

  it('should return empty Blob from exportDxf (placeholder)', async () => {
    const result = await api.exportDxf(mockParams);
    expect(result).toBeInstanceOf(Blob);
    expect(result.size).toBe(0);
  });

  it('should return empty string from exportCsv (placeholder)', async () => {
    const result = await api.exportCsv(mockParams);
    expect(result).toBe('');
  });

  it('should return empty string from exportSvg (placeholder)', async () => {
    const result = await api.exportSvg(mockParams);
    expect(result).toBe('');
  });

  it('should return empty Blob from exportExcel (placeholder)', async () => {
    const result = await api.exportExcel(mockParams);
    expect(result).toBeInstanceOf(Blob);
    expect(result.size).toBe(0);
  });

  it('should return empty Blob from exportGif (placeholder)', async () => {
    const result = await api.exportGif(mockParams);
    expect(result).toBeInstanceOf(Blob);
    expect(result.size).toBe(0);
  });
});