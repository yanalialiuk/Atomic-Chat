import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getBackendDir,
  getBackendExePath,
  isBackendInstalled,
  fetchRemoteBackends,
} from '../backend'
import { getSystemInfo } from '../hardware'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { fs, getJanDataFolderPath } from '@janhq/core'

// Mock constants: Hardcode path string directly inside the mock to avoid hoisting issues
const MOCK_JAN_PATH_STRING = '/path/to/jan'

// Mock the core dependencies
vi.mock('@janhq/core', () => ({
  getJanDataFolderPath: vi.fn().mockResolvedValue('/path/to/jan'),
  fs: {
    existsSync: vi.fn(),
    readdirSync: vi.fn().mockResolvedValue([]),
    fileStat: vi.fn(),
    rm: vi.fn().mockResolvedValue(undefined),
  },
  joinPath: vi.fn(async (paths: string[]) => paths.join('/')),
  events: {
    emit: vi.fn(),
  },
}))
vi.mock('../hardware', () => ({
  getSystemInfo: vi.fn(),
}))
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}))
vi.mock('../util', () => ({
  getProxyConfig: vi.fn(() => undefined),
}))

vi.stubGlobal('IS_WINDOWS', false)

describe('Backend functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock getJanDataFolderPath explicitly to a simple path
    vi.mocked(getJanDataFolderPath).mockResolvedValue('/path/to/jan')

    vi.mocked(getSystemInfo).mockResolvedValue({
      os_type: 'linux',
      cpu: {
        arch: 'x86_64',
        extensions: [],
      },
      gpus: [],
    } as any)

    // Default mock for isBackendInstalled dependencies
    vi.mocked(fs.existsSync).mockImplementation(async (path: string) => {
      if (path.includes('build')) return true
      return false
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getBackendDir and getBackendExePath', () => {
    it('should use the specific backend name for directory path', async () => {
      vi.mocked(fs.existsSync).mockImplementation(async (path: string) =>
        path.includes('build')
      ) // Mock build dir check

      const dir = await getBackendDir('linux-avx2-x64', 'v1.2.3')
      expect(dir).toBe(`/path/to/jan/llamacpp-upstream/backends/v1.2.3/linux-avx2-x64`)

      const exePath = await getBackendExePath('linux-avx2-x64', 'v1.2.3')
      expect(exePath).toBe(
        `/path/to/jan/llamacpp-upstream/backends/v1.2.3/linux-avx2-x64/build/bin/llama-server`
      )
    })

    it('should use the new common backend name for directory path if it was the asset name', async () => {
      vi.mocked(fs.existsSync).mockImplementation(async (path: string) =>
        path.includes('build')
      ) // Mock build dir check

      const dir = await getBackendDir('win-common_cpus-x64', 'v2.0.0')
      expect(dir).toBe(
        `/path/to/jan/llamacpp-upstream/backends/v2.0.0/win-common_cpus-x64`
      )

      const exePath = await getBackendExePath('win-common_cpus-x64', 'v2.0.0')
      expect(exePath).toBe(
        `/path/to/jan/llamacpp-upstream/backends/v2.0.0/win-common_cpus-x64/build/bin/llama-server`
      )
    })

    it('finds llama-server when the archive unpacks with an extra top-level folder', async () => {
      // Repro of the "downloaded but UI says not installed" re-download loop:
      // the ggml-org ubuntu tarball unpacks to
      //   <backendDir>/<archive-name>/build/bin/llama-server
      // which neither canonical path (<dir>/build/bin or <dir>/) catches.
      const backendDir =
        '/path/to/jan/llamacpp-upstream/backends/b9691/linux-vulkan-x64'
      const archive = `${backendDir}/llama-b9691-bin-ubuntu-vulkan-x64`
      const buildDir = `${archive}/build`
      const binDir = `${buildDir}/bin`
      const exe = `${binDir}/llama-server`

      const dirs = new Set([backendDir, archive, buildDir, binDir])
      const children: Record<string, string[]> = {
        [backendDir]: ['llama-b9691-bin-ubuntu-vulkan-x64'],
        [archive]: ['build'],
        [buildDir]: ['bin'],
        [binDir]: ['llama-server'],
      }

      // Canonical paths don't exist; everything else (incl. the real exe) does.
      vi.mocked(fs.existsSync).mockImplementation(async (p: string) => {
        if (p === `${backendDir}/build/bin/llama-server`) return false
        if (p === `${backendDir}/llama-server`) return false
        return true
      })
      vi.mocked(fs.readdirSync).mockImplementation(
        async (p: string) => children[p] ?? []
      )
      vi.mocked(fs.fileStat).mockImplementation(async (p: string) => ({
        isDirectory: dirs.has(p),
        size: 1,
      }))

      const exePath = await getBackendExePath('linux-vulkan-x64', 'b9691')
      expect(exePath).toBe(exe)

      const installed = await isBackendInstalled('linux-vulkan-x64', 'b9691')
      expect(installed).toBe(true)
    })
  })

  describe('isBackendInstalled', () => {
    it('should return true when backend is installed using its specific name', async () => {
      vi.stubGlobal('IS_WINDOWS', false) // Linux/macOS for llama-server
      // Mock both the check for the 'build' directory and the final executable path
      vi.mocked(fs.existsSync).mockImplementation(async (path: string) => {
        const expectedExePath = `/path/to/jan/llamacpp-upstream/backends/v1.0.0/win-avx2-x64/build/bin/llama-server`
        if (path === expectedExePath) return true
        if (path.endsWith('/build')) return true
        return false
      })

      const result = await isBackendInstalled('win-avx2-x64', 'v1.0.0')
      expect(result).toBe(true)
      // Check that it was called with the final exe path
      expect(fs.existsSync).toHaveBeenCalledWith(
        `/path/to/jan/llamacpp-upstream/backends/v1.0.0/win-avx2-x64/build/bin/llama-server`
      )
    })
  })
  describe('isBackendInstalled', () => {
    it('should return true when backend is installed using its specific name', async () => {
      vi.stubGlobal('IS_WINDOWS', false) // Linux/macOS for llama-server
      // Mock both the check for the 'build' directory and the final executable path
      vi.mocked(fs.existsSync).mockImplementation(async (path: string) => {
        const expectedExePath = `${MOCK_JAN_PATH_STRING}/llamacpp-upstream/backends/v1.0.0/win-avx2-x64/build/bin/llama-server`
        if (path === expectedExePath) return true
        if (path.endsWith('/build')) return true
        return false
      })

      const result = await isBackendInstalled('win-avx2-x64', 'v1.0.0')
      expect(result).toBe(true)
      // Check that it was called with the final exe path
      expect(fs.existsSync).toHaveBeenCalledWith(
        `${MOCK_JAN_PATH_STRING}/llamacpp-upstream/backends/v1.0.0/win-avx2-x64/build/bin/llama-server`
      )
    })
  })
})

describe('fetchRemoteBackends (atomic-chat-conf manifest, ATO-199)', () => {
  // Mirrors the static manifest in atomic-chat-conf/backends/manifest.json:
  // a GitHub release shape ({ tag_name, assets: [{ name }] }).
  const MANIFEST = {
    $schema: './schema.json',
    updated_at: '2026-06-17T00:00:00Z',
    tag_name: 'b9691',
    assets: [
      { name: 'llama-b9691-bin-win-cpu-x64.zip' },
      { name: 'llama-b9691-bin-win-cuda-12.4-x64.zip' },
      { name: 'llama-b9691-bin-win-cuda-13.3-x64.zip' },
      { name: 'llama-b9691-bin-win-vulkan-x64.zip' },
      { name: 'llama-b9691-bin-ubuntu-x64.tar.gz' },
      { name: 'llama-b9691-bin-ubuntu-vulkan-x64.tar.gz' },
      { name: 'cudart-llama-bin-win-cuda-12.4-x64.zip' },
      { name: 'cudart-llama-bin-win-cuda-13.3-x64.zip' },
    ],
  }

  const RAW_MANIFEST_URL =
    'https://raw.githubusercontent.com/AtomicBot-ai/atomic-chat-conf/main/backends/manifest.json'

  const okResponse = (body: unknown) =>
    ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => body,
    }) as unknown as Response

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(tauriFetch).mockResolvedValue(okResponse(MANIFEST))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves the manifest from raw atomic-chat-conf, not api.github.com', async () => {
    vi.mocked(getSystemInfo).mockResolvedValue({
      os_type: 'windows',
      cpu: { arch: 'x86_64', extensions: [] },
      gpus: [],
    } as any)

    await fetchRemoteBackends()

    // fetchManifestWithFallbacks races three transports in parallel via
    // Promise.any: webview fetch (globalThis.fetch, unmocked here) plus the
    // proxy-aware and direct tauri-fetch fallbacks — so tauriFetch fires
    // twice. The point of this test is the URL, not the call count: every
    // attempt must hit the raw atomic-chat-conf manifest, never api.github.com.
    expect(tauriFetch).toHaveBeenCalled()
    for (const call of vi.mocked(tauriFetch).mock.calls) {
      expect(call[0]).toBe(RAW_MANIFEST_URL)
      expect(call[0]).not.toContain('api.github.com')
    }
  })

  it('returns the whitelisted Windows backend catalog', async () => {
    vi.mocked(getSystemInfo).mockResolvedValue({
      os_type: 'windows',
      cpu: { arch: 'x86_64', extensions: [] },
      gpus: [],
    } as any)

    const backends = await fetchRemoteBackends()
    const names = backends.map((b) => b.backend).sort()

    expect(names).toEqual([
      'win-cpu-x64',
      'win-cuda-12.4-x64',
      'win-cuda-13.3-x64',
      'win-vulkan-x64',
    ])
    // cudart companions are not surfaced as backends.
    expect(names).not.toContain('cudart-llama-bin-win-cuda-12.4-x64')
    backends.forEach((b) => expect(b.version).toBe('b9691'))
  })

  it('returns cpu + vulkan for Linux x64', async () => {
    vi.mocked(getSystemInfo).mockResolvedValue({
      os_type: 'linux',
      cpu: { arch: 'x86_64', extensions: [] },
      gpus: [],
    } as any)

    const backends = await fetchRemoteBackends()
    const names = backends.map((b) => b.backend).sort()

    expect(names).toEqual(['linux-cpu-x64', 'linux-vulkan-x64'])
    backends.forEach((b) => expect(b.version).toBe('b9691'))
  })

  it('returns [] on macOS without any network call to the manifest', async () => {
    vi.mocked(getSystemInfo).mockResolvedValue({
      os_type: 'macos',
      cpu: { arch: 'arm64', extensions: [] },
      gpus: [],
    } as any)

    const backends = await fetchRemoteBackends()

    expect(backends).toEqual([])
    expect(tauriFetch).not.toHaveBeenCalled()
  })

  it('returns [] when the manifest fetch fails (offline floor)', async () => {
    vi.mocked(getSystemInfo).mockResolvedValue({
      os_type: 'windows',
      cpu: { arch: 'x86_64', extensions: [] },
      gpus: [],
    } as any)
    vi.mocked(tauriFetch).mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: () => null },
      json: async () => ({}),
    } as unknown as Response)

    const backends = await fetchRemoteBackends()
    expect(backends).toEqual([])
  })
})
