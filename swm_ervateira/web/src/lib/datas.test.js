import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { paraData, chaveDoDia } from './datas.js'

describe('chaveDoDia', () => {
  test('carga da manhã fica no dia dela', () => {
    assert.equal(chaveDoDia(new Date(2026, 7, 11, 10, 3)), '2026-08-11')
  })

  test('carga das 21h30 fica no dia dela, e não no seguinte', () => {
    assert.equal(chaveDoDia(new Date(2026, 7, 11, 21, 30)), '2026-08-11')
  })

  test('23h59 ainda é o mesmo dia', () => {
    assert.equal(chaveDoDia(new Date(2026, 7, 11, 23, 59)), '2026-08-11')
  })

  test('00h01 já é o dia seguinte', () => {
    assert.equal(chaveDoDia(new Date(2026, 7, 12, 0, 1)), '2026-08-12')
  })

  test('duas cargas do mesmo dia, uma de manhã e uma de noite, caem no mesmo balde', () => {
    const manha = chaveDoDia(new Date(2026, 7, 11, 8, 0))
    const noite = chaveDoDia(new Date(2026, 7, 11, 22, 45))
    assert.equal(manha, noite)
  })

  test('vira o mês e o ano corretamente', () => {
    assert.equal(chaveDoDia(new Date(2026, 11, 31, 22, 0)), '2026-12-31')
    assert.equal(chaveDoDia(new Date(2027, 0, 1, 1, 0)), '2027-01-01')
  })

  test('documenta o comportamento antigo, que era o bug', () => {
    const noite = new Date('2026-08-11T21:30:00-03:00')
    assert.equal(noite.toISOString().slice(0, 10), '2026-08-12')
  })
})

describe('paraData', () => {
  test('data sem hora é lida como o dia local, não como UTC', () => {
    const d = paraData('2026-08-11')
    assert.equal(d.getFullYear(), 2026)
    assert.equal(d.getMonth(), 7)
    assert.equal(d.getDate(), 11)
  })

  test('a chave de agrupamento volta a ser o mesmo dia depois de formatada', () => {
    const chave = chaveDoDia(new Date(2026, 7, 11, 21, 30))
    assert.equal(paraData(chave).getDate(), 11)
  })

  test('data com hora continua sendo convertida do UTC', () => {
    const d = paraData('2026-08-11T13:03:00Z')
    assert.equal(d.getTime(), Date.parse('2026-08-11T13:03:00Z'))
  })

  test('aceita Date e número sem alterar', () => {
    const agora = new Date()
    assert.equal(paraData(agora).getTime(), agora.getTime())
    assert.equal(paraData(agora.getTime()).getTime(), agora.getTime())
  })
})
