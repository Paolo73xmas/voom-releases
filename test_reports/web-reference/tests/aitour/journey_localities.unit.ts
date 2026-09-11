import assert from 'node:assert/strict'
import { exactLocality, suggestPortfolioLocalities } from '../../src/lib/aitour/journey-localities'
import type { JourneyStage } from '../../src/lib/aitour/brief-journey'

function run() {
  const stages: JourneyStage[] = [
    { name: 'Milano', direction: 'S', radiusKm: 8, point: { lat: 45.4642, lng: 9.19, label: 'Milano, MI, Italia' } },
    { name: 'Pavia', direction: null, radiusKm: 8, point: { lat: 45.1847, lng: 9.1582, label: 'Pavia, PV, Italia' } },
  ]

  const towns = [
    { city: 'Rozzano', province: 'MI', lat: 45.38, lng: 9.16 },
    { city: 'Loano', province: 'SV', lat: 44.13, lng: 8.25 },
    { city: 'Loiano', province: 'BO', lat: 44.27, lng: 11.32 },
    { city: 'Loazzolo', province: 'AT', lat: 44.65, lng: 8.11 },
    { city: 'Rozzano', province: 'MI', lat: 45.381, lng: 9.158 },
  ]

  const suggestions = suggestPortfolioLocalities('Lozano', towns, stages)
  assert.ok(suggestions.length > 0)
  assert.equal(suggestions[0].city, 'Rozzano', 'Lozano should rank Rozzano from nearby portfolio cities')
  assert.ok(suggestions.every((s) => s.city !== 'Loiano' && s.city !== 'Loazzolo'), 'distant homonyms should be filtered')

  // Exact locality checks must not accept non-exact geocoder labels.
  assert.equal(exactLocality('Lozano', { lat: 45.381, lng: 9.158, label: 'Rozzano, Milano, Lombardia, Italia' }), false)
  assert.equal(exactLocality('Rozzano', { lat: 45.381, lng: 9.158, label: 'Rozzano, Milano, Lombardia, Italia' }), true)

  console.log('PASS journey_localities.unit.ts')
}

run()
