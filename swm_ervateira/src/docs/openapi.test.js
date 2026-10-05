const { test } = require('node:test')
const assert = require('node:assert/strict')

const { montar } = require('./openapi')

test('cada rota documentada tem resumo e grupo', () => {
  const spec = montar()
  for (const [caminho, ops] of Object.entries(spec.paths)) {
    for (const [metodo, op] of Object.entries(ops)) {
      assert.ok(op.summary, `${metodo} ${caminho} sem resumo`)
      assert.ok(op.tags?.length, `${metodo} ${caminho} sem grupo`)
    }
  }
})

test('parâmetro de caminho vira parâmetro obrigatório', () => {
  const op = montar().paths['/api/cargas/{id}/tara'].patch
  assert.deepEqual(op.parameters.map((p) => p.name), ['id'])
})
