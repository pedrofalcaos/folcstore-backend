import unittest
from core import candidatos, criar_pool, paralelo, sequencial


class RankingTest(unittest.TestCase):
    def test_top_k_equivale_a_ordenacao_completa_inclusive_empates(self):
        produtos = [dict(id=str(i), descricao='Peça artesanal', tecnica='barro',
                         regiaoProducao='Olinda') for i in range(17)]
        for limite in [0, 1, 4, 30]:
            for origem in produtos:
                esperado = sorted(candidatos(produtos, origem), key=lambda p: (-p['score'], p['produtoId']))[:limite]
                self.assertEqual(sequencial(produtos, [origem['id']], limite)[0]['itens'], esperado)

    def test_equivalencia_e_exclusao_da_origem(self):
        produtos = [dict(id=str(i), descricao='Peça artesanal de barro ' + str(i),
                         tecnica='barro' if i % 2 else 'madeira', regiaoProducao='Olinda') for i in range(12)]
        ids = [p['id'] for p in produtos]
        referencia = sequencial(produtos, ids, 4)
        with criar_pool(2) as pool:
            self.assertEqual(referencia, paralelo(pool, produtos, ids, 4))
        for r in referencia:
            self.assertEqual(4, len(r['itens']))
            self.assertNotIn(r['produtoId'], [i['produtoId'] for i in r['itens']])
            self.assertEqual(sorted(r['itens'], key=lambda p: (-p['score'], p['produtoId'])), r['itens'])

    def test_catalogo_unitario(self):
        p = dict(id='1', descricao='Peça única', tecnica='barro', regiaoProducao='Olinda')
        self.assertEqual(sequencial([p], ['1']), [{'produtoId': '1', 'itens': []}])


if __name__ == '__main__':
    unittest.main()
