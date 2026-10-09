import { describe, expect, it } from 'vitest'
import { assertServiceable, Config, resolveProfiles, type Options } from '../src/config.ts'

/** Validate one hand-declared route, with the caller's fields layered onto it. */
const routeWith = (profile: Record<string, unknown>): (() => unknown) =>
  () => ({ providers: Config({
    providers: {
      'acme-gateway': {
        api: 'openai-completions',
        baseURL: 'https://acme.test',
        models: [{ id: 'm' }],
        ...profile,
      },
    },
  }).providers.get() })

/** Validate that route with the caller's fields on its single model entry. */
const configWith = (model: Record<string, unknown>): (() => unknown) =>
  routeWith({ models: [{ id: 'm', ...model }] })

describe('reasoning schema boundary', () => {
  it('accepts an empty provider section and propagates unexpected catalog failures', () => {
    expect(() => { assertServiceable({}) }).not.toThrow()
    const failure = new TypeError('model metadata lookup failed')
    expect(() => resolveProfiles({ openrouter: { models: [{
      id: '111',
      get name(): string { throw failure },
    }], api: 'openai-completions' } }, 'deferred')).toThrow(failure)
  })

  it('rejects a level pi-ai does not know at the write that produced it', () => {
    expect(configWith({ reasoningEfforts: { ultra: 'x' } })).toThrow(/"off"/)
    expect(configWith({ reasoningEfforts: { high: 42 } })).toThrow()
  })

  it('keeps false distinguishable from an absent declaration', () => {
    type Materialized = { providers: Record<string, { models?: { reasoningEfforts?: unknown }[] }> }
    const withFalse = configWith({ reasoningEfforts: false })() as Materialized
    expect(withFalse.providers['acme-gateway']?.models?.[0]?.reasoningEfforts).toBe(false)
    const absent = configWith({})() as Materialized
    expect(absent.providers['acme-gateway']?.models?.[0]?.reasoningEfforts).toBeUndefined()
  })

  it('rejects a thinking format outside the offered set', () => {
    expect(configWith({ compat: { thinkingFormat: 'quantum' } })).toThrow(/expected/)
  })

  it('accepts Baseten template arguments and completion controls', () => {
    expect(configWith({
      compat: {
        supportsFinishReason: false,
        thinkingFormat: 'baseten',
        chatTemplateArgs: { enable_thinking: { $var: 'thinking.enabled' } },
        supportsThinkingTokenBudget: true,
      },
    })).not.toThrow()
  })
})

describe('modality schema boundary', () => {
  it('rejects a modality pi-ai does not know, at either level', () => {
    expect(configWith({ input: ['audio'] })).toThrow(/expected/)
    expect(routeWith({ defaultInput: ['text', 'audio'] })).toThrow(/expected/)
  })

  it('refuses a route whose models could accept nothing', () => {
    // The pair the settings seam runs: the schema accepts the empty list as
    // well-typed, and the namespace validator is what refuses it. Asserting
    // only the schema would report this route as writable.
    expect(routeWith({ defaultInput: [] })).not.toThrow()
    expect(() => { assertServiceable(routeWith({ defaultInput: [] })() as Options) })
      .toThrow(/defaultInput must name at least one modality/)
  })

  type Materialized = {
    providers: Record<string, { defaultInput?: unknown; models?: { input?: unknown }[] }>
  }

  it('materializes an absent entry list as empty and an absent route list as text', () => {
    // The empty-list inheritance rule exists because of exactly this: an entry
    // that declares nothing reaches resolution as `[]`, not as `undefined`.
    const absent = configWith({})() as Materialized
    expect(absent.providers['acme-gateway']?.models?.[0]?.input).toEqual([])
    expect(absent.providers['acme-gateway']?.defaultInput).toEqual(['text'])
  })
})

describe('request image policy bounds', () => {
  it.each([
    ['requestImagePixelBudget', 0, /requestImagePixelBudget must be a positive safe integer/],
    ['requestImagePixelBudget', Number.MAX_SAFE_INTEGER + 1, /requestImagePixelBudget must be a positive safe integer/],
    ['requestImageMaxBytes', 0, /requestImageMaxBytes must be a positive safe integer/],
    ['requestImageMaxBytes', 1.5, /requestImageMaxBytes must be a positive safe integer/],
  ] as const)('rejects %s=%s at service resolution', (field, value, message) => {
    const programmatic = {
      providers: {
        'acme-gateway': {
          api: 'openai-completions',
          baseURL: 'https://acme.test',
          models: [{ id: 'm' }],
          [field]: value,
        },
      },
    } as Options
    expect(() => {
      assertServiceable(programmatic)
    }).toThrow(message)
  })
})

describe('speed tier validation', () => {
  /** Resolve one hand-declared route without the schema, as `assertServiceable` does for a write. */
  const resolveRoute = (profile: Record<string, unknown>): (() => unknown) =>
    () => { assertServiceable({ providers: { 'acme-gateway': {
      api: 'openai-completions',
      baseURL: 'https://acme.test',
      models: [{ id: 'm' }],
      ...profile,
    } } }) }
  const resolveModel = (model: Record<string, unknown>): (() => unknown) =>
    resolveRoute({ models: [{ id: 'm', ...model }] })
  const fast = { name: 'Fast', body: { service_tier: 'priority' } }

  it('resolves route tiers onto models and lets a model entry replace or clear them', () => {
    const resolved = resolveProfiles({
      'acme-gateway': {
        api: 'openai-completions',
        baseURL: 'https://acme.test',
        speedTiers: { fast: { ...fast, headers: { 'x-tier': 'fast' } } },
        models: [
          { id: 'inherits' },
          { id: 'replaces', speedTiers: { ultrafast: { name: 'Ultrafast', description: 'Most usage', body: { service_tier: 'ultrafast' } } } },
          { id: 'cleared', speedTiers: false },
        ],
      },
    }).get('acme-gateway')
    expect(resolved?.modelSpeedTiers.get('inherits')).toEqual([
      { id: 'fast', name: 'Fast', body: { service_tier: 'priority' }, headers: { 'x-tier': 'fast' } },
    ])
    expect(resolved?.modelSpeedTiers.get('replaces')).toEqual([
      { id: 'ultrafast', name: 'Ultrafast', description: 'Most usage', body: { service_tier: 'ultrafast' } },
    ])
    expect(resolved?.modelSpeedTiers.has('cleared')).toBe(false)
    expect(resolved).not.toHaveProperty('speedTiers')
  })

  it('keeps an absent model declaration distinguishable from false', () => {
    type Materialized = { providers: Record<string, { models?: { speedTiers?: unknown }[] }> }
    expect((configWith({ speedTiers: false })() as Materialized).providers['acme-gateway']?.models?.[0]?.speedTiers).toBe(false)
    expect((configWith({})() as Materialized).providers['acme-gateway']?.models?.[0]?.speedTiers).toBeUndefined()
  })

  it('rejects tiers that cannot describe or send a request at the write that produced them', () => {
    expect(configWith({ speedTiers: { fast: { body: { service_tier: 'priority' } } } })).toThrow()
    expect(resolveRoute({ speedTiers: { fast: { name: '', body: { service_tier: 'priority' } } } }))
      .toThrow(/route speedTiers.fast needs a non-empty name/)
    expect(resolveRoute({ speedTiers: { fast: { name: 'Fast', body: {} } } }))
      .toThrow(/route speedTiers.fast needs a non-empty body/)
    expect(resolveRoute({ speedTiers: { '': fast } })).toThrow(/empty tier id/)
    expect(resolveRoute({ speedTiers: { fast: { ...fast, headers: { 'bad header': 'x' } } } }))
      .toThrow(/speedTiers.fast header "bad header" is not valid for Fetch/)
    expect(resolveModel({ speedTiers: {} })).toThrow(/model "m" has an empty speedTiers/)
    expect(resolveModel({ speedTiers: { fast: { name: 'Fast', body: { when: new Date(0) } } } }))
      .toThrow(/body.when must be a JSON value/)
  })
})
