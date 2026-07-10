#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RADAR DE EDITAIS — ICET / CMDDI
Varre as fontes de editais/fontes.json, pontua a pertinência de cada link
contra os objetivos institucionais (povos indígenas, cultura, artesanato,
patrimônio, direitos, mulheres...), acumula os achados em editais/editais.json
(sem nunca apagar os campos preenchidos manualmente no ADM) e envia alerta
por e-mail via Brevo quando aparece edital novo relevante.

Honestidade de engenharia: este radar ENCONTRA e AVISA. A leitura fina do
edital (prazo exato, documentos exigidos, elegibilidade) é feita no ADM
(editais.html) — sites de terceiros mudam de layout o tempo todo e extrair
esses campos automaticamente de qualquer página seria frágil e enganoso.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

RAIZ = os.path.dirname(os.path.abspath(__file__))
F_FONTES = os.path.join(RAIZ, "fontes.json")
F_EDITAIS = os.path.join(RAIZ, "editais.json")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

# Pesos de pertinência aos objetivos institucionais do ICET e do CMDDI
PALAVRAS = {
    5: ["indígena", "indigena", "indígenas", "indigenas", "indigenous",
        "povos originários", "povos originarios", "terena"],
    4: ["povos tradicionais", "comunidades tradicionais", "povos e comunidades"],
    3: ["artesanato", "cerâmica", "ceramica", "patrimônio cultural",
        "patrimonio cultural", "línguas", "linguas", "saberes tradicionais",
        "salvaguarda"],
    2: ["cultura", "cultural", "mulheres", "direitos humanos", "juventude",
        "economia criativa", "meio ambiente", "biodiversidade", "clima",
        "museu", "memória", "memoria", "propriedade intelectual",
        "marca coletiva", "indicação geográfica", "indicacao geografica"],
    1: ["edital", "chamada", "chamamento", "prêmio", "premio", "fomento",
        "seleção", "selecao", "inscrições", "inscricoes", "grant", "grants",
        "funding", "call for proposals", "apoio a projetos"],
}


def agora():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def carregar(path, padrao):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return padrao


def gravar(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def baixar(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA,
                                               "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.6"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8", errors="ignore")


def extrair_links(html, base_url):
    """Extrai pares (url_absoluta, texto) de todos os <a> da página."""
    achados = []
    for m in re.finditer(r'<a\s[^>]*href="([^"#]+)"[^>]*>(.*?)</a>', html,
                         re.IGNORECASE | re.DOTALL):
        href, texto = m.group(1), m.group(2)
        texto = re.sub(r"<[^>]+>", " ", texto)
        texto = re.sub(r"\s+", " ", texto).strip()
        if len(texto) < 18 or len(texto) > 300:
            continue
        url = urllib.parse.urljoin(base_url, href)
        if not url.startswith("http"):
            continue
        achados.append((url, texto))
    return achados


def pontuar(texto):
    t = texto.lower()
    score, encontradas = 0, []
    for peso, termos in PALAVRAS.items():
        for termo in termos:
            if termo in t:
                score += peso
                encontradas.append(termo)
    return score, encontradas


def enviar_alerta_brevo(novos, config):
    chave = os.environ.get("BREVO_API_KEY", "").strip()
    destinos = config.get("avisos_emails", [])
    if not chave or not destinos or not novos:
        if novos and not chave:
            print("AVISO: editais novos encontrados, mas BREVO_API_KEY não está "
                  "configurada como secret — nenhum e-mail enviado.")
        if novos and not destinos:
            print("AVISO: cadastre e-mails de aviso no ADM (editais.html) para "
                  "receber alertas.")
        return
    linhas = "".join(
        f"<li><b>{e['titulo']}</b><br>{e['fonte']} — pertinência {e['relevancia']}"
        f"<br><a href='{e['url']}'>{e['url']}</a></li><br>"
        for e in novos)
    corpo = {
        "sender": {"email": config.get("remetente_email", "contato@vertticonsultoria.com.br"),
                    "name": config.get("remetente_nome", "Radar de Editais ICET/CMDDI")},
        "to": [{"email": d} for d in destinos],
        "subject": f"🪶 Radar de Editais: {len(novos)} oportunidade(s) nova(s) para ICET/CMDDI",
        "htmlContent": (
            "<h3>Novas oportunidades encontradas pelo Radar</h3><ul>" + linhas +
            "</ul><p>Analise, defina o prazo e os documentos no painel: "
            "<a href='https://institutocaciqueenirterena.com.br/editais.html'>"
            "ADM de Editais</a></p>"),
    }
    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(corpo).encode("utf-8"), method="POST",
        headers={"api-key": chave, "Content-Type": "application/json",
                 "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"Alerta enviado por e-mail para {len(destinos)} destinatário(s) "
                  f"(HTTP {r.status}).")
    except Exception as exc:
        print(f"AVISO: falha ao enviar alerta Brevo: {exc}")


def main():
    fontes = carregar(F_FONTES, {}).get("fontes", [])
    dados = carregar(F_EDITAIS, {"config": {"avisos_emails": [],
                                             "remetente_email": "contato@vertticonsultoria.com.br",
                                             "remetente_nome": "Radar de Editais ICET/CMDDI",
                                             "score_minimo": 3},
                                  "editais": [], "vistos": []})
    vistos = set(dados.get("vistos", []))
    existentes = {e["url"] for e in dados["editais"]}
    score_min = dados.get("config", {}).get("score_minimo", 3)
    novos, fontes_ok, fontes_erro = [], 0, 0

    for fonte in fontes:
        try:
            html = baixar(fonte["url"])
            fontes_ok += 1
        except Exception as exc:
            fontes_erro += 1
            print(f"[FALHA ] {fonte['nome']}: {exc}")
            continue
        candidatos = extrair_links(html, fonte["url"])
        aceitos = 0
        for url, texto in candidatos:
            if url in vistos:
                continue
            vistos.add(url)
            score, termos = pontuar(texto)
            if score < score_min or url in existentes:
                continue
            item = {
                "id": f"ed{abs(hash(url)) % 10**10}",
                "titulo": texto,
                "url": url,
                "fonte": fonte["nome"],
                "tipo": fonte["tipo"],
                "relevancia": score,
                "palavras": sorted(set(termos)),
                "encontrado_em": agora(),
                "status": "novo",
                "prazo_final": "",
                "orgao": "",
                "valor": "",
                "documentos": [],
                "notas": "",
                "arquivos": [],
            }
            dados["editais"].append(item)
            existentes.add(url)
            novos.append(item)
            aceitos += 1
        print(f"[OK    ] {fonte['nome']}: {len(candidatos)} links lidos, "
              f"{aceitos} novos relevantes")

    # 'vistos' limitado aos 20000 mais recentes para o arquivo não crescer sem fim
    dados["vistos"] = list(vistos)[-20000:]
    dados["ultima_varredura"] = agora()
    dados["ultima_varredura_resumo"] = (f"{fontes_ok} fontes lidas, {fontes_erro} "
                                         f"com falha, {len(novos)} editais novos")
    gravar(F_EDITAIS, dados)
    print(f"\n=== Varredura concluída: {dados['ultima_varredura_resumo']} ===")

    enviar_alerta_brevo(sorted(novos, key=lambda e: -e["relevancia"]),
                        dados.get("config", {}))


if __name__ == "__main__":
    main()
    sys.exit(0)
