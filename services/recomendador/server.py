"""Serviço HTTP independente, sem dependências externas. Python 3.11+."""
import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import BoundedSemaphore
from time import perf_counter
from core import criar_pool, paralelo, sequencial


class Handler(BaseHTTPRequestHandler):
    def responder(self, status, dados):
        corpo = json.dumps(dados, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_GET(self):
        self.responder(200, {'status': 'ok', 'servico': 'recomendador'}) if self.path == '/health' else self.responder(404, {'erro': 'Rota não encontrada'})

    def do_POST(self):
        if self.path != '/recomendacoes':
            return self.responder(404, {'erro': 'Rota não encontrada'})
        try:
            tamanho = int(self.headers.get('Content-Length', '0'))
            if not 0 < tamanho <= 2_000_000:
                return self.responder(413, {'erro': 'Limite: 2 MB'})
            entrada = json.loads(self.rfile.read(tamanho))
            produtos, ids = entrada['produtos'], entrada['ids']
            modo, limite = entrada.get('modo', 'paralelo'), entrada.get('limite', 4)
            if not isinstance(produtos, list) or not 1 <= len(produtos) <= 2000:
                raise ValueError('Envie entre 1 e 2000 produtos')
            campos = ('id', 'descricao', 'tecnica', 'regiaoProducao')
            if any(not isinstance(p, dict) or any(not isinstance(p.get(c), str) or not 1 <= len(p[c]) <= 3000 for c in campos) for p in produtos):
                raise ValueError('Campos dos produtos inválidos')
            conhecidos = {p['id'] for p in produtos}
            if len(conhecidos) != len(produtos) or not isinstance(ids, list) or not 1 <= len(ids) <= 2000 or any(not isinstance(i, str) or i not in conhecidos for i in ids):
                raise ValueError('IDs inválidos ou duplicidade no catálogo')
            if type(limite) is not int or not 1 <= limite <= 20 or modo not in ('sequencial', 'paralelo'):
                raise ValueError('Modo ou limite inválido')
        except (ValueError, KeyError, TypeError):
            return self.responder(400, {'erro': 'Corpo de recomendações inválido'})
        # Contrapressão: não acumula lotes caros indefinidamente.
        if not self.server.vagas.acquire(blocking=False):
            return self.responder(503, {'erro': 'Serviço ocupado; tente novamente'})
        try:
            inicio = perf_counter()
            resultados = paralelo(self.server.pool, produtos, ids, limite) if modo == 'paralelo' else sequencial(produtos, ids, limite)
            self.responder(200, {'modo': modo, 'resultados': resultados, 'duracaoMs': round((perf_counter() - inicio) * 1000, 3)})
        except Exception:
            self.responder(500, {'erro': 'Falha no processamento'})
        finally:
            self.server.vagas.release()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=3004)
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    if not 1 <= args.workers <= 16:
        parser.error('workers deve estar entre 1 e 16')
    with criar_pool(args.workers) as pool:
        servidor = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
        servidor.pool, servidor.vagas = pool, BoundedSemaphore(2)
        print(f'Recomendador: http://127.0.0.1:{args.port} ({args.workers} processos)', flush=True)
        try:
            servidor.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            servidor.server_close()
