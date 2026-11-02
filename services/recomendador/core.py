"""Ranking de produtos reais: técnica, região e similaridade da descrição."""
from concurrent.futures import ProcessPoolExecutor
from difflib import SequenceMatcher
from heapq import nsmallest
import multiprocessing


def candidatos(produtos, origem):
    """Calcula scores sob demanda, sem guardar todos os candidatos em uma lista."""
    for p in produtos:
        if p['id'] == origem['id']:
            continue
        similaridade = SequenceMatcher(None, origem['descricao'], p['descricao'], autojunk=False).ratio()
        mesma_tecnica = p['tecnica'] == origem['tecnica']
        mesma_regiao = p['regiaoProducao'] == origem['regiaoProducao']
        score = round(.5 * mesma_tecnica + .2 * mesma_regiao + .3 * similaridade, 6)
        yield {'produtoId': p['id'], 'score': score,
               'motivo': 'mesma_tecnica' if mesma_tecnica else 'similaridade_descricao'}


def recomendar(tarefa):
    produtos, origem, limite = tarefa
    # Mantém só os k melhores: O(N log k), preservando o desempate por ID.
    itens = nsmallest(limite, candidatos(produtos, origem), key=lambda p: (-p['score'], p['produtoId']))
    return {'produtoId': origem['id'], 'itens': itens}


def sequencial(produtos, ids, limite=4):
    indice = {p['id']: p for p in produtos}
    return [recomendar((produtos, indice[id_], limite)) for id_ in ids]


def paralelo(pool, produtos, ids, limite=4):
    # Cada processo calcula o ranking completo de uma origem; map preserva a ordem.
    indice = {p['id']: p for p in produtos}
    return list(pool.map(recomendar, ((produtos, indice[id_], limite) for id_ in ids),
                         chunksize=max(1, len(ids) // 16)))


def criar_pool(workers):
    # spawn funciona no Windows e evita depender de fork no Linux.
    return ProcessPoolExecutor(max_workers=workers, mp_context=multiprocessing.get_context('spawn'))
