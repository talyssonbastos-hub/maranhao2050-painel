"""Gera dados públicos do painel a partir da matriz oficial do Maranhão 2050."""

from __future__ import annotations

import json
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd


RAIZ = Path(__file__).resolve().parents[1]
ARQUIVO_ORIGEM = (
    RAIZ
    / "data"
    / "origem"
    / "Matriz_contribuicoes_entidades_Plano_Maranhao_2050_atualizada (3).xlsx"
)
DIRETORIO_SAIDA = RAIZ / "web" / "public" / "data"

ABAS = {
    "ranking-integrado": {
        "nome": "Ranking Integrado",
        "cabecalhos": ["Posição", "Tema, ativo ou passivo"],
        "coluna_id": "Posição",
        "obrigatorias": [
            "Posição",
            "Tipo",
            "Tema, ativo ou passivo",
            "Área de resultado",
            "Origem",
            "Score final (0–100)",
            "Prioridade",
        ],
    },
    "escuta-tecnica": {
        "nome": "Escuta Técnica",
        "cabecalhos": ["Nº", "Tema, ativo ou passivo identificado"],
        "coluna_id": "Nº",
        "obrigatorias": [
            "Nº",
            "Tipo",
            "Tema, ativo ou passivo identificado",
            "Área de resultado",
            "Prioridade na escuta",
        ],
    },
    "lacunas-indicadores": {
        "nome": "Lacunas Indicadores",
        "cabecalhos": ["Estado", "Sistema / painel", "Lacunas atendidas"],
        "coluna_id": "Sistema / painel",
        "obrigatorias": [
            "Estado",
            "Sistema / painel",
            "Instituição responsável",
            "Lacunas atendidas",
        ],
    },
    "sefaz": {
        "nome": "SEFAZ",
        "cabecalhos": ["Nº", "Tema, ativo ou passivo identificado"],
        "coluna_id": "Nº",
        "obrigatorias": [
            "Nº",
            "Tipo",
            "Tema, ativo ou passivo identificado",
            "Área de resultado",
            "Cobertura da área",
        ],
    },
}


def texto(valor: Any) -> str:
    """Transforma uma célula em texto de comparação, preservando valores vazios."""
    if valor is None or pd.isna(valor):
        return ""
    return str(valor).strip()


def localizar_linha_cabecalho(planilha: str, cabecalhos: list[str]) -> int:
    bruto = pd.read_excel(ARQUIVO_ORIGEM, sheet_name=planilha, header=None, nrows=80)

    for indice, linha in bruto.iterrows():
        valores = {texto(valor) for valor in linha.tolist()}
        if all(cabecalho in valores for cabecalho in cabecalhos):
            return int(indice)

    raise ValueError(
        f"Não encontrei os cabeçalhos {cabecalhos} na aba '{planilha}'. "
        "Confira se a estrutura da matriz foi alterada."
    )


def valor_json(valor: Any) -> Any:
    """Converte valores do pandas/Excel para tipos compatíveis com JSON."""
    if valor is None:
        return None
    if isinstance(valor, (pd.Timestamp, datetime, date)):
        return valor.isoformat()
    try:
        if pd.isna(valor):
            return None
    except TypeError:
        pass
    if hasattr(valor, "item"):
        valor = valor.item()
    if isinstance(valor, float):
        return round(valor, 4)
    if isinstance(valor, str):
        return valor.strip()
    return valor


def ler_aba(configuracao: dict[str, Any]) -> list[dict[str, Any]]:
    linha_cabecalho = localizar_linha_cabecalho(
        configuracao["nome"], configuracao["cabecalhos"]
    )
    dados = pd.read_excel(
        ARQUIVO_ORIGEM, sheet_name=configuracao["nome"], header=linha_cabecalho
    )
    dados.columns = [texto(coluna) for coluna in dados.columns]
    dados = dados.loc[:, [coluna for coluna in dados.columns if not coluna.startswith("Unnamed")]]
    dados = dados.dropna(how="all")

    ausentes = [
        coluna
        for coluna in configuracao["obrigatorias"]
        if coluna not in dados.columns
    ]
    if ausentes:
        raise ValueError(
            f"Aba '{configuracao['nome']}' sem coluna(s) obrigatória(s): {ausentes}."
        )

    coluna_id = configuracao["coluna_id"]
    dados = dados[dados[coluna_id].notna()]

    if coluna_id in {"Posição", "Nº"}:
        dados = dados[pd.to_numeric(dados[coluna_id], errors="coerce").notna()]

    return [
        {coluna: valor_json(valor) for coluna, valor in linha.items()}
        for _, linha in dados.iterrows()
    ]


def contagem(registros: list[dict[str, Any]], campo: str) -> dict[str, int]:
    return dict(
        sorted(
            Counter(
                str(registro[campo])
                for registro in registros
                if registro.get(campo) not in (None, "")
            ).items()
        )
    )


def salvar_json(nome: str, conteudo: Any) -> None:
    destino = DIRETORIO_SAIDA / f"{nome}.json"
    with destino.open("w", encoding="utf-8") as arquivo:
        json.dump(conteudo, arquivo, ensure_ascii=False, indent=2)
        arquivo.write("\n")


def main() -> None:
    if not ARQUIVO_ORIGEM.exists():
        raise FileNotFoundError(f"Arquivo de origem não encontrado: {ARQUIVO_ORIGEM}")

    DIRETORIO_SAIDA.mkdir(parents=True, exist_ok=True)
    exportacoes = {nome: ler_aba(config) for nome, config in ABAS.items()}

    for nome, registros in exportacoes.items():
        salvar_json(nome, registros)

    ranking = exportacoes["ranking-integrado"]
    metadados = {
        "titulo": "Painel Maranhão 2050 — Contribuições, Prioridades e Lacunas",
        "geradoEm": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "fonte": ARQUIVO_ORIGEM.name,
        "registros": {
            "rankingIntegrado": len(ranking),
            "escutaTecnica": len(exportacoes["escuta-tecnica"]),
            "sistemasDeReferencia": len(exportacoes["lacunas-indicadores"]),
            "evidenciasSefaz": len(exportacoes["sefaz"]),
        },
        "distribuicao": {
            "porTipo": contagem(ranking, "Tipo"),
            "porArea": contagem(ranking, "Área de resultado"),
            "porPrioridade": contagem(ranking, "Prioridade"),
        },
        "metodologia": {
            "adesaoDesafiosEMaturidade": 0.40,
            "votacaoEscuta": 0.25,
            "qualidadeDaInformacao": 0.20,
            "factibilidadeFiscalOrientativa": 0.15,
            "nota": (
                "A referência da SEFAZ orienta a leitura fiscal por área. "
                "Não substitui orçamento, EVTEA ou análise setorial."
            ),
        },
    }
    salvar_json("metadados", metadados)

    print("Exportação concluída:")
    for nome, registros in exportacoes.items():
        print(f"- {nome}: {len(registros)} registro(s)")


if __name__ == "__main__":
    main()
