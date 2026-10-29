"""Benchmark CPU: mesma função e entradas; inclui serialização e coleta dos resultados."""
import argparse
import csv
import hashlib
import json
import os
import platform
import random
import statistics
import sys
from pathlib import Path
from time import perf_counter

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'services' / 'recomendador'))
from core import criar_pool, paralelo, sequencial


def catalogo(n):
    # Massa sintética determinística: não insere nada no banco de desenvolvimento.
    rng = random.Random(42)
    tecnicas = ['barro', 'entalhe', 'renda', 'xilogravura']
    regioes = ['Olinda', 'Caruaru', 'Tracunhaém', 'Bezerros']
    palavras = ['feito', 'artesanal', 'barro', 'madeira', 'peça', 'natural', 'pintura', 'regional', 'decoração', 'manual', 'tradicional', 'cultura']
    return [{'id': f'p{i:05}', 'tecnica': tecnicas[i % 4], 'regiaoProducao': regioes[i % 4],
             'descricao': ' '.join(rng.choices(palavras, k=12))} for i in range(n)]


def digest(resultado):
    return hashlib.sha256(json.dumps(resultado, sort_keys=True).encode()).hexdigest()


def medir(funcao):
    inicio = perf_counter()
    resultado = funcao()
    return perf_counter() - inicio, resultado


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--sizes', type=int, nargs='+', default=[16, 128, 384])
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--repetitions', type=int, default=5)
    parser.add_argument('--output', default='benchmarks/resultados')
    args = parser.parse_args()
    if not 1 <= args.workers <= 16 or args.repetitions < 3 or any(n < 2 or n > 2000 for n in args.sizes):
        parser.error('Use 1..16 processos, pelo menos 3 repetições, volumes 2..2000')
    pasta = Path(args.output)
    pasta.mkdir(parents=True, exist_ok=True)
    linhas, resumo = [], []
    for n in args.sizes:
        produtos = catalogo(n)
        ids = [p['id'] for p in produtos]
        # Aquecimento da implementação e referência de correção fora das medições.
        referencia = sequencial(produtos, ids)
        with criar_pool(args.workers) as pool:
            assert paralelo(pool, produtos, ids) == referencia
            for repeticao in range(args.repetitions):
                # Alternância minimiza favorecimento sistemático por ordem/cache/turbo.
                modos = ['sequencial', 'paralelo'] if repeticao % 2 == 0 else ['paralelo', 'sequencial']
                for modo in modos:
                    segundos, saida = medir(lambda: sequencial(produtos, ids) if modo == 'sequencial' else paralelo(pool, produtos, ids))
                    assert saida == referencia, 'Resultados divergentes'
                    linhas.append({'produtos': n, 'origens': n, 'repeticao': repeticao + 1,
                                   'modo': modo, 'segundos': segundos, 'origens_por_segundo': n / segundos,
                                   'sha256': digest(saida)})
                print(f'{n} produtos: comparação {repeticao + 1}/{args.repetitions} concluída', flush=True)
        def frio():
            with criar_pool(args.workers) as pool:
                return paralelo(pool, produtos, ids)
        # Inclui criação e encerramento dos processos, diferente do pool persistente.
        for repeticao in range(args.repetitions):
            segundos, saida = medir(frio)
            assert saida == referencia
            linhas.append({'produtos': n, 'origens': n, 'repeticao': repeticao + 1,
                           'modo': 'paralelo_frio', 'segundos': segundos,
                           'origens_por_segundo': n / segundos, 'sha256': digest(saida)})
        tempos = {modo: [r['segundos'] for r in linhas if r['produtos'] == n and r['modo'] == modo]
                  for modo in ['sequencial', 'paralelo', 'paralelo_frio']}
        medianas = {m: statistics.median(t) for m, t in tempos.items()}
        registro = {'produtos': n, 'medianas_segundos': medianas,
                    'speedup': medianas['sequencial'] / medianas['paralelo'],
                    'speedup_frio': medianas['sequencial'] / medianas['paralelo_frio'],
                    'min_max_segundos': {m: [min(t), max(t)] for m, t in tempos.items()}}
        resumo.append(registro)
        print(json.dumps(registro), flush=True)
        # Salva após cada volume, inclusive em execuções longas.
        with (pasta / 'cpu.csv').open('w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=list(linhas[0]))
            writer.writeheader()
            writer.writerows(linhas)
        (pasta / 'cpu.json').write_text(json.dumps({'ambiente': {
            'data': __import__('datetime').datetime.now().astimezone().isoformat(),
            'python': sys.version, 'sistema': platform.platform(), 'processador': platform.processor(),
            'cpus_logicas': os.cpu_count(), 'workers': args.workers, 'repeticoes': args.repetitions,
            'semente': 42, 'descricao_palavras': 12, 'limite_recomendacoes': 4,
            'comando': ' '.join(sys.argv),
        }, 'resultados': resumo}, indent=2, ensure_ascii=False), encoding='utf-8')
