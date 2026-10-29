import unittest
from core import criar_pool, paralelo, sequencial


class RankingTest(unittest.TestCase):
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
