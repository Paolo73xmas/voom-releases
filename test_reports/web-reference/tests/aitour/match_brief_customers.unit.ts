import assert from 'node:assert/strict'
import { matchBriefCustomers, type BriefCustomer } from '../../src/lib/aitour/brief-customers'

function c(over: Partial<BriefCustomer>): BriefCustomer {
  return {
    id: over.id ?? crypto.randomUUID(),
    name: over.name ?? 'Cliente',
    crmName: over.crmName ?? '',
    contactName: over.contactName ?? '',
    resaleCode: over.resaleCode ?? '',
    city: over.city ?? 'Brescia',
    province: over.province ?? 'BS',
    address: over.address ?? 'Via Roma 1',
    lat: over.lat ?? 45.54,
    lng: over.lng ?? 10.22,
  }
}

function run() {
  const base = [
    c({ id: 'rossi-bs', name: 'Tabacchi Rossi', city: 'Brescia', address: 'Via Milano 1' }),
    c({ id: 'rossi-bg', name: 'Tabacchi Rossi', city: 'Bergamo', address: 'Via Bergamo 2' }),
    c({ id: 'fumagalli', name: 'Tabacchi Fumagalli', city: 'Brescia', address: 'Via Dante 3' }),
    c({ id: 'code-only', name: 'Anonimo', resaleCode: 'RIV123', city: 'Lumezzane', address: 'Via Mazzini 10' }),
  ]

  // Fuzzy typo Rosii -> Rossi should resolve/ambiguate but never unresolved with good options
  const rossiTypo = matchBriefCustomers({ rawReference: 'Rosii', cityHint: 'Brescia' }, base)
  assert.notEqual(rossiTypo.status, 'unresolved')
  assert.ok(rossiTypo.options.some((x) => x.name.toLowerCase().includes('rossi')))

  // Fuzzy typo Fumagali -> Fumagalli should find expected customer among options
  const fumagaliTypo = matchBriefCustomers({ rawReference: 'Fumagali' }, base)
  assert.notEqual(fumagaliTypo.status, 'unresolved')
  assert.equal(fumagaliTypo.options[0]?.id, 'fumagalli')

  // Same surname across cities should require explicit choice (ambiguous)
  const rossiNoCity = matchBriefCustomers({ rawReference: 'Rossi' }, base)
  assert.equal(rossiNoCity.status, 'ambiguous')
  assert.ok(rossiNoCity.options.length >= 2)

  // Unique city-only hint should still require confirmation (never auto-resolve)
  const cityOnly = matchBriefCustomers({ rawReference: '', cityHint: 'Lumezzane' }, base)
  assert.equal(cityOnly.status, 'ambiguous')
  assert.equal(cityOnly.options.length, 1)
  assert.equal(cityOnly.options[0].id, 'code-only')

  // Must match on contactName/registry/address/resaleCode as candidate sources
  const byContact = matchBriefCustomers({ rawReference: 'Mario' }, [c({ id: 'ct', name: 'Bar XYZ', contactName: 'Mario Bianchi' })])
  assert.notEqual(byContact.status, 'unresolved')
  const byAddress = matchBriefCustomers({ rawReference: 'Mazzini 10' }, base)
  assert.notEqual(byAddress.status, 'unresolved')
  const byCode = matchBriefCustomers({ rawReference: 'RIV123' }, base)
  assert.notEqual(byCode.status, 'unresolved')

  // No invented match when nothing is close
  const none = matchBriefCustomers({ rawReference: 'ClienteInesistenteTotaleZZZ' }, base)
  assert.equal(none.status, 'unresolved')
  assert.equal(none.options.length, 0)

  // Regression guard: null/empty ids should not dedupe distinct records incorrectly
  const nullIdA = c({ id: '' as unknown as string, name: 'Rossi Uno', city: 'Brescia' })
  const nullIdB = c({ id: '' as unknown as string, name: 'Rossi Due', city: 'Desenzano' })
  const nullIdMatch = matchBriefCustomers({ rawReference: 'Rossi' }, [nullIdA, nullIdB])
  assert.ok(
    nullIdMatch.options.length >= 2,
    'Distinct rows with empty/null-like IDs are being collapsed by dedup'
  )

  console.log('PASS match_brief_customers.unit.ts')
}

run()
