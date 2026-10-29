"""Ranking de produtos reais: técnica, região e similaridade da descrição."""
from concurrent.futures import ProcessPoolExecutor
from difflib import SequenceMatcher
import multiprocessing


def recomendar(tarefa):
    produtos, origem_id, limite = tarefa
    origem = next(p for p in produtos if p['id'] == origem_id)
    itens = []
    for p in produtos:
        if p['id'] == origem_id:
            continue
        similaridade = SequenceMatcher(None, origem['descricao'], p['descricao'], autojunk=False).ratio()
        mesma_tecnica = p['tecnica'] == origem['tecnica']
        mesma_regiao = p['regiaoProducao'] == origem['regiaoProducao']
        score = round(.5 * mesma_tecnica + .2 * mesma_regiao + .3 * similaridade, 6)
        itens.append({'produtoId': p['id'], 'score': score,
                      'motivo': 'mesma_tecnica' if mesma_tecnica else 'similaridade_descricao'})
    itens.sort(key=lambda p: (-p['score'], p['produtoId']))
    return {'produtoId': origem_id, 'itens': itens[:limite]}


def sequencial(produtos, ids, limite=4):
    return [recomendar((produtos, id_, limite)) for id_ in ids]


def paralelo(pool, produtos, ids, limite=4):
    # Cada processo calcula o ranking completo de uma origem; map preserva a ordem.
    return list(pool.map(recomendar, ((produtos, id_, limite) for id_ in ids),
                         chunksize=max(1, len(ids) // 16)))


def criar_pool(workers):
    # spawn funciona no Windows e evita depender de fork no Linux.
    return ProcessPoolExecutor(max_workers=workers, mp_context=multiprocessing.get_context('spawn'))
