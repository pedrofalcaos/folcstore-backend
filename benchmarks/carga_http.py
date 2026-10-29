"""Teste de carga local em circuito fechado; requer os dois serviços ativos."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import statistics
import platform
import sys
from datetime import datetime
from time import perf_counter
from urllib.request import urlopen


def chamada(url):
    inicio = perf_counter()
    try:
        with urlopen(url, timeout=20) as res:
            res.read()
            status = res.status
    except Exception as erro:
        return {'ms': (perf_counter() - inicio) * 1000, 'status': getattr(erro, 'code', 0)}
    return {'ms': (perf_counter() - inicio) * 1000, 'status': status}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='http://127.0.0.1:3003/api')
    args = parser.parse_args()
    with urlopen(args.base + '/produtos') as r:
        catalogo = json.load(r)
        produto_id = catalogo['dados'][0]['id']
    cenarios = [('catalogo', '/produtos', 40),
                ('recomendacao_sequencial', f'/recomendacoes?produtoId={produto_id}&modo=sequencial', 10),
                ('recomendacao_paralela', f'/recomendacoes?produtoId={produto_id}&modo=paralelo', 10)]
    resultados = []
    for nome, rota, quantidade in cenarios:
        chamada(args.base + rota)  # aquecimento
        for concorrencia in [1, 4]:
            inicio = perf_counter()
            with ThreadPoolExecutor(max_workers=concorrencia) as pool:
                amostras = list(pool.map(chamada, [args.base + rota] * quantidade))
            segundos = perf_counter() - inicio
            latencias = sorted(a['ms'] for a in amostras)
            resultados.append({'cenario': nome, 'concorrencia': concorrencia,
                               'requisicoes': quantidade, 'segundos': segundos,
                               'sucessos': sum(a['status'] == 200 for a in amostras),
                               'erros': sum(a['status'] != 200 for a in amostras),
                               'throughput_rps': quantidade / segundos,
                               'throughput_sucesso_rps': sum(a['status'] == 200 for a in amostras) / segundos,
                               'mediana_ms': statistics.median(latencias),
                               'p95_ms': latencias[__import__('math').ceil(.95 * len(latencias)) - 1],
                               'amostras': amostras})
            print(json.dumps({k: v for k, v in resultados[-1].items() if k != 'amostras'}), flush=True)
    pasta = Path('benchmarks/resultados')
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / 'http.json').write_text(json.dumps(resultados, indent=2), encoding='utf-8')
    (pasta / 'http-ambiente.json').write_text(json.dumps({
        'data': datetime.now().astimezone().isoformat(), 'sistema': platform.platform(),
        'python': sys.version, 'base': args.base, 'repeticoes_por_cenario': 1,
        'concorrencias': [1, 4], 'catalogo_produtos': catalogo['total'],
        'comando': ' '.join(sys.argv),
    }, indent=2), encoding='utf-8')
    if any(r['erros'] for r in resultados):
        raise SystemExit('Houve erros: consulte os status nas amostras')
