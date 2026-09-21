import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import './index.css'

type Registro = Record<string, unknown>

type Metadados = {
  titulo: string
  geradoEm: string
  fonte: string
  registros: Record<string, number>
  distribuicao: {
    porTipo: Record<string, number>
    porArea: Record<string, number>
    porPrioridade: Record<string, number>
  }
  metodologia: {
    adesaoDesafiosEMaturidade: number
    votacaoEscuta: number
    qualidadeDaInformacao: number
    factibilidadeFiscalOrientativa: number
    nota: string
  }
}

type Visao = 'Resumo' | 'Ranking' | 'Escuta' | 'Lacunas' | 'Método'

type AreaConfig = {
  chave: string
  nome: string
  nomeCurto: string
  cor: string
  ordem: number
}

const CORES_IDENTIDADE = {
  vermelho: '#D42028',
  amarelo: '#ECA820',
  turquesa: '#00A0B0',
  laranja: '#E47C2C',
  verde: '#50C08C',
  cinza: '#5C6066',
}

const AREAS: AreaConfig[] = [
  {
    chave: 'educa',
    nome: 'Educação, Identidade e Cultura Transformadoras e Estruturantes',
    nomeCurto: 'Educação, identidade e cultura',
    cor: '#F4C034',
    ordem: 1,
  },
  {
    chave: 'econom',
    nome: 'Economia Próspera e Inclusiva',
    nomeCurto: 'Economia',
    cor: '#E0382C',
    ordem: 2,
  },
  {
    chave: 'meio ambiente',
    nome: 'Meio Ambiente Valorizado e Resiliente',
    nomeCurto: 'Meio ambiente',
    cor: '#50C08C',
    ordem: 3,
  },
  {
    chave: 'sociedade',
    nome: 'Sociedade Saudável, Segura e Justa',
    nomeCurto: 'Sociedade',
    cor: '#F4A840',
    ordem: 4,
  },
  {
    chave: 'governan',
    nome: 'Governança Efetiva, Conectada e Inovadora',
    nomeCurto: 'Governança',
    cor: '#2CA4B0',
    ordem: 5,
  },
]

const VISOES: Visao[] = ['Resumo', 'Ranking', 'Escuta', 'Lacunas', 'Método']

function texto(valor: unknown) {
  return String(valor ?? '').trim()
}

function numero(valor: unknown) {
  if (typeof valor === 'number') return valor
  const convertido = Number(texto(valor).replace(',', '.'))
  return Number.isFinite(convertido) ? convertido : 0
}

function normalizar(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

function configArea(valor: unknown): AreaConfig {
  const valorNormalizado = normalizar(texto(valor))
  const encontrada = AREAS.find((item) => valorNormalizado.includes(normalizar(item.chave)))
  return encontrada ?? {
    chave: valorNormalizado || 'nao informado',
    nome: texto(valor) || 'Não informado',
    nomeCurto: texto(valor) || 'Não informado',
    cor: '#7A8087',
    ordem: 99,
  }
}

function nomeArea(valor: unknown) {
  return configArea(valor).nome
}

function corArea(valor: unknown) {
  return configArea(valor).cor
}

function arquivoPublico(nome: string) {
  return `${import.meta.env.BASE_URL}data/${nome}`
}

async function carregarJson<T>(nome: string): Promise<T> {
  const resposta = await fetch(arquivoPublico(nome))
  if (!resposta.ok) throw new Error(`Não foi possível carregar ${nome}.`)
  return resposta.json() as Promise<T>
}

function contar(registros: Registro[], campo: string) {
  return registros.reduce<Record<string, number>>((acumulado, registro) => {
    const chave = texto(registro[campo]) || 'Não informado'
    acumulado[chave] = (acumulado[chave] ?? 0) + 1
    return acumulado
  }, {})
}

function selecoesDaEscuta(registro: Registro) {
  const correspondencia = texto(registro['Prioridade na escuta']).match(/Seleções:\s*(\d+)/i)
  return correspondencia ? Number(correspondencia[1]) : 0
}

function rotuloFactibilidade(valor: string) {
  const normalizado = valor.toLocaleLowerCase('pt-BR')
  if (normalizado.includes('alta')) return 'selo selo--alta'
  if (normalizado.includes('baixa')) return 'selo selo--baixa'
  return 'selo selo--media'
}

type CampoOrdenacao =
  | 'Posição'
  | 'Tema, ativo ou passivo'
  | 'Área de resultado'
  | 'Tipo'
  | 'Origem'
  | 'Score final (0–100)'
  | 'Prioridade'
  | 'Grau de factibilidade'

type DirecaoOrdenacao = 'asc' | 'desc'
type ItemPaginacao = number | '…'

const COLUNAS_EXPORTACAO: Array<{ rotulo: string; campo: string }> = [
  { rotulo: 'Posição', campo: 'Posição' },
  { rotulo: 'Tema / ativo / passivo', campo: 'Tema, ativo ou passivo' },
  { rotulo: 'Área de Resultado', campo: 'Área de resultado' },
  { rotulo: 'Tipo', campo: 'Tipo' },
  { rotulo: 'Origem', campo: 'Origem' },
  { rotulo: 'Score final (0–100)', campo: 'Score final (0–100)' },
  { rotulo: 'Prioridade', campo: 'Prioridade' },
  { rotulo: 'Factibilidade', campo: 'Grau de factibilidade' },
  { rotulo: 'Desafio(s) do Plano', campo: 'Desafio(s) do Plano' },
  { rotulo: 'Indicador do Plano associado', campo: 'Indicador do Plano associado' },
  { rotulo: 'Fonte e localização', campo: 'Fonte e localização' },
]

function valorParaOrdenacao(registro: Registro, campo: CampoOrdenacao) {
  if (campo === 'Posição' || campo === 'Score final (0–100)') {
    return numero(registro[campo])
  }

  if (campo === 'Área de resultado') {
    return nomeArea(registro[campo])
  }

  return texto(registro[campo])
}

function compararRegistros(
  a: Registro,
  b: Registro,
  campo: CampoOrdenacao,
  direcao: DirecaoOrdenacao,
) {
  const valorA = valorParaOrdenacao(a, campo)
  const valorB = valorParaOrdenacao(b, campo)

  let resultado = 0

  if (typeof valorA === 'number' && typeof valorB === 'number') {
    resultado = valorA - valorB
  } else {
    resultado = String(valorA).localeCompare(String(valorB), 'pt-BR', {
      numeric: true,
      sensitivity: 'base',
    })
  }

  return direcao === 'asc' ? resultado : -resultado
}

function paginasVisiveis(atual: number, total: number): ItemPaginacao[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, indice) => indice + 1)
  }

  let inicio = Math.max(2, atual - 1)
  let fim = Math.min(total - 1, atual + 1)

  if (atual <= 4) {
    inicio = 2
    fim = 5
  }

  if (atual >= total - 3) {
    inicio = total - 4
    fim = total - 1
  }

  const itens: ItemPaginacao[] = [1]

  if (inicio > 2) itens.push('…')

  for (let pagina = inicio; pagina <= fim; pagina += 1) {
    itens.push(pagina)
  }

  if (fim < total - 1) itens.push('…')

  itens.push(total)
  return itens
}

function valorExportacao(registro: Registro, campo: string) {
  if (campo === 'Área de resultado') return nomeArea(registro[campo])
  if (campo === 'Score final (0–100)') return numero(registro[campo]).toFixed(1)
  return texto(registro[campo])
}

function escaparCsv(valor: string) {
  return `"${valor.replace(/"/g, '""')}"`
}

function baixarCsv(registros: Registro[]) {
  const cabecalho = COLUNAS_EXPORTACAO
    .map((coluna) => escaparCsv(coluna.rotulo))
    .join(';')

  const linhas = registros.map((registro) =>
    COLUNAS_EXPORTACAO
      .map((coluna) => escaparCsv(valorExportacao(registro, coluna.campo)))
      .join(';'),
  )

  const conteudo = `\uFEFF${[cabecalho, ...linhas].join('\r\n')}`
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const data = new Date().toISOString().slice(0, 10)

  link.href = url
  link.download = `ranking_maranhao_2050_${data}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function classeTipo(valor: unknown) {
  const tipo = normalizar(texto(valor))
  if (tipo.includes('ativo')) return 'tipo tipo--ativo'
  if (tipo.includes('passivo')) return 'tipo tipo--passivo'
  if (tipo.includes('proposta')) return 'tipo tipo--proposta'
  return 'tipo'
}

function TabelaRanking({
  registros,
  campoOrdenacao,
  direcaoOrdenacao,
  aoOrdenar,
}: {
  registros: Registro[]
  campoOrdenacao?: CampoOrdenacao
  direcaoOrdenacao?: DirecaoOrdenacao
  aoOrdenar?: (campo: CampoOrdenacao) => void
}) {
  function cabecalho(rotulo: string, campo: CampoOrdenacao) {
    if (!aoOrdenar) return <th>{rotulo}</th>

    const ativo = campoOrdenacao === campo
    const ariaSort = ativo
      ? (direcaoOrdenacao === 'asc' ? 'ascending' : 'descending')
      : 'none'

    return (
      <th aria-sort={ariaSort}>
        <button
          type="button"
          className={`cabecalho-ordenavel ${ativo ? 'ativo' : ''}`}
          onClick={() => aoOrdenar(campo)}
          title={`Ordenar por ${rotulo}`}
        >
          <span>{rotulo}</span>
          <span className="icone-ordenacao" aria-hidden="true">
            {ativo ? (direcaoOrdenacao === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        </button>
      </th>
    )
  }

  return (
    <div className="tabela-wrap">
      <table>
        <thead>
          <tr>
            {cabecalho('Pos.', 'Posição')}
            {cabecalho('Tema / ativo / passivo', 'Tema, ativo ou passivo')}
            {cabecalho('Área de Resultado', 'Área de resultado')}
            {cabecalho('Tipo', 'Tipo')}
            {cabecalho('Origem', 'Origem')}
            {cabecalho('Score', 'Score final (0–100)')}
            {cabecalho('Prioridade', 'Prioridade')}
            {cabecalho('Factibilidade', 'Grau de factibilidade')}
          </tr>
        </thead>
        <tbody>
          {registros.map((registro) => (
            <tr key={`${texto(registro['Posição'])}-${texto(registro['Tema, ativo ou passivo'])}`}>
              <td className="posicao">{texto(registro['Posição'])}</td>
              <td className="tema">
                <strong>{texto(registro['Tema, ativo ou passivo'])}</strong>
                <details>
                  <summary>Ver evidência e vínculo</summary>
                  <p><b>Desafio:</b> {texto(registro['Desafio(s) do Plano']) || 'Não informado'}</p>
                  <p><b>Indicador:</b> {texto(registro['Indicador do Plano associado']) || 'Não informado'}</p>
                  <p><b>Fonte:</b> {texto(registro['Fonte e localização']) || 'Não informado'}</p>
                </details>
              </td>
              <td>
                <span
                  className="area"
                  style={{ backgroundColor: corArea(registro['Área de resultado']) }}
                  title={nomeArea(registro['Área de resultado'])}
                >
                  {nomeArea(registro['Área de resultado'])}
                </span>
              </td>
              <td><span className={classeTipo(registro.Tipo)}>{texto(registro.Tipo)}</span></td>
              <td>{texto(registro.Origem)}</td>
              <td><span className="score">{numero(registro['Score final (0–100)']).toFixed(1)}</span></td>
              <td>{texto(registro.Prioridade)}</td>
              <td>
                <span className={rotuloFactibilidade(texto(registro['Grau de factibilidade']))}>
                  {texto(registro['Grau de factibilidade'])}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {registros.length === 0 && (
        <div className="tabela-vazia">
          Nenhum registro encontrado para os filtros selecionados.
        </div>
      )}
    </div>
  )
}

function App() {
  const [ranking, setRanking] = useState<Registro[]>([])
  const [escuta, setEscuta] = useState<Registro[]>([])
  const [lacunas, setLacunas] = useState<Registro[]>([])
  const [metadados, setMetadados] = useState<Metadados | null>(null)
  const [visao, setVisao] = useState<Visao>('Resumo')
  const [area, setArea] = useState('Todas')
  const [tipo, setTipo] = useState('Todos')
  const [origem, setOrigem] = useState('Todas')
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState(25)
  const [campoOrdenacao, setCampoOrdenacao] = useState<CampoOrdenacao>('Score final (0–100)')
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<DirecaoOrdenacao>('desc')

  useEffect(() => {
    Promise.all([
      carregarJson<Registro[]>('ranking-integrado.json'),
      carregarJson<Registro[]>('escuta-tecnica.json'),
      carregarJson<Registro[]>('lacunas-indicadores.json'),
      carregarJson<Metadados>('metadados.json'),
    ])
      .then(([dadosRanking, dadosEscuta, dadosLacunas, dadosMetadados]) => {
        setRanking(dadosRanking)
        setEscuta(dadosEscuta)
        setLacunas(dadosLacunas)
        setMetadados(dadosMetadados)
      })
      .catch((causa: Error) => setErro(causa.message))
  }, [])

  const areas = useMemo(
    () => Array.from(new Set(ranking.map((registro) => texto(registro['Área de resultado']))))
      .filter(Boolean)
      .sort((a, b) => configArea(a).ordem - configArea(b).ordem),
    [ranking],
  )

  const tipos = useMemo(
    () => Array.from(new Set(ranking.map((registro) => texto(registro.Tipo)))).filter(Boolean).sort(),
    [ranking],
  )

  const origens = useMemo(
    () => Array.from(new Set(ranking.map((registro) => texto(registro.Origem)))).filter(Boolean).sort(),
    [ranking],
  )

  const filtrados = useMemo(() => ranking
    .filter((registro) => area === 'Todas' || texto(registro['Área de resultado']) === area)
    .filter((registro) => tipo === 'Todos' || texto(registro.Tipo) === tipo)
    .filter((registro) => origem === 'Todas' || texto(registro.Origem) === origem)
    .filter((registro) => texto(registro['Tema, ativo ou passivo']).toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')))
    .sort((a, b) => numero(b['Score final (0–100)']) - numero(a['Score final (0–100)'])),
    [ranking, area, tipo, origem, busca],
  )

  const top10 = filtrados.slice(0, 10)

  const rankingOrdenado = useMemo(
    () => [...filtrados].sort((a, b) =>
      compararRegistros(a, b, campoOrdenacao, direcaoOrdenacao),
    ),
    [filtrados, campoOrdenacao, direcaoOrdenacao],
  )

  const totalRegistrosRanking = rankingOrdenado.length
  const totalPaginasRanking = Math.max(1, Math.ceil(totalRegistrosRanking / itensPorPagina))
  const inicioPagina = (paginaAtual - 1) * itensPorPagina
  const fimPagina = inicioPagina + itensPorPagina
  const rankingPaginado = rankingOrdenado.slice(inicioPagina, fimPagina)
  const paginasRanking = paginasVisiveis(paginaAtual, totalPaginasRanking)

  const porArea = contar(filtrados, 'Área de resultado')
  const porTipo = contar(filtrados, 'Tipo')

  const escutaOrdenada = useMemo(() => escuta
    .filter((registro) => area === 'Todas' || texto(registro['Área de resultado']) === area)
    .filter((registro) => tipo === 'Todos' || texto(registro.Tipo) === tipo)
    .sort((a, b) => selecoesDaEscuta(b) - selecoesDaEscuta(a)), [escuta, area, tipo])

  useEffect(() => {
    setPaginaAtual(1)
  }, [area, tipo, origem, busca, itensPorPagina])

  useEffect(() => {
    if (paginaAtual > totalPaginasRanking) {
      setPaginaAtual(totalPaginasRanking)
    }
  }, [paginaAtual, totalPaginasRanking])

  function ordenarRanking(campo: CampoOrdenacao) {
    setPaginaAtual(1)

    if (campo === campoOrdenacao) {
      setDirecaoOrdenacao((direcao) => direcao === 'asc' ? 'desc' : 'asc')
      return
    }

    setCampoOrdenacao(campo)
    setDirecaoOrdenacao(campo === 'Score final (0–100)' ? 'desc' : 'asc')
  }

  const dadosArea = Object.keys(porArea)
    .sort((a, b) => configArea(a).ordem - configArea(b).ordem)

  const graficoArea: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: { left: 12, right: 28, top: 22, bottom: 36, containLabel: true },
    xAxis: {
      type: 'value',
      name: 'Número de registros',
      nameLocation: 'middle',
      nameGap: 28,
      minInterval: 1,
    },
    yAxis: {
      type: 'category',
      data: dadosArea.map((chave) => configArea(chave).nomeCurto),
      axisLabel: { width: 150, overflow: 'break', lineHeight: 15 },
    },
    series: [{
      type: 'bar',
      barMaxWidth: 30,
      data: dadosArea.map((chave) => ({
        value: porArea[chave],
        itemStyle: {
          color: corArea(chave),
          borderRadius: [0, 8, 8, 0],
        },
      })),
    }],
  }

  const graficoTipo: EChartsOption = {
    color: [
      CORES_IDENTIDADE.turquesa,
      CORES_IDENTIDADE.vermelho,
      CORES_IDENTIDADE.amarelo,
      CORES_IDENTIDADE.laranja,
      CORES_IDENTIDADE.verde,
    ],
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['52%', '76%'],
      label: { formatter: '{b}: {c}' },
      data: Object.entries(porTipo).map(([name, value]) => ({ name, value })),
    }],
  }

  const graficoEscuta: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 12, right: 20, top: 18, bottom: 100, containLabel: true },
    xAxis: {
      type: 'category',
      name: 'Temas mais selecionados',
      nameLocation: 'middle',
      nameGap: 78,
      data: escutaOrdenada.slice(0, 12).map((registro) => texto(registro['Tema, ativo ou passivo identificado'])),
      axisLabel: { rotate: 35, width: 110, overflow: 'truncate' },
    },
    yAxis: { type: 'value', minInterval: 1, name: 'Seleções' },
    series: [{
      type: 'bar',
      barMaxWidth: 42,
      data: escutaOrdenada.slice(0, 12).map((registro) => ({
        value: selecoesDaEscuta(registro),
        itemStyle: {
          color: corArea(registro['Área de resultado']),
          borderRadius: [7, 7, 0, 0],
        },
      })),
    }],
  }

  if (erro) return <main className="estado"><h1>Painel indisponível</h1><p>{erro}</p></main>
  if (!metadados) return <main className="estado"><p>Carregando dados da matriz…</p></main>

  const dataGeracao = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(metadados.geradoEm))

  return (
    <main className="painel">
      <header className="cabecalho">
        <div className="cabecalho-conteudo">
          <div className="marca">
            <span className="marca-simbolo" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <div>
              <p className="sobretitulo">PLANO MARANHÃO 2050</p>
              <h1>Contribuições, prioridades e lacunas</h1>
              <p className="subtitulo">
                Revisão e priorização estratégica · Base atualizada em {dataGeracao}
              </p>
            </div>
          </div>

          <div className="cabecalho-meta">
            <span className="fonte-base">Fonte: {metadados.fonte}</span>
            <strong className="selo-base">{metadados.registros.rankingIntegrado}</strong>
            <span className="selo-legenda">registros integrados</span>
          </div>
        </div>

        <div className="faixa-identidade" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </header>

      <nav className="navegacao" aria-label="Seções do painel">
        {VISOES.map((item) => (
          <button
            key={item}
            className={visao === item ? 'ativo' : ''}
            onClick={() => setVisao(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      <section className="areas-resultado" aria-label="Áreas de Resultado do Plano Maranhão 2050">
        {areas.map((item) => {
          const config = configArea(item)
          const selecionada = area === item
          return (
            <button
              type="button"
              key={item}
              className={`area-card ${selecionada ? 'selecionada' : ''}`}
              style={{ borderTopColor: config.cor }}
              onClick={() => setArea(selecionada ? 'Todas' : item)}
              title={`Filtrar por ${config.nome}`}
            >
              <span className="area-card-cor" style={{ backgroundColor: config.cor }} />
              <strong>{config.nome}</strong>
              <span>{ranking.filter((registro) => texto(registro['Área de resultado']) === item).length} registros</span>
            </button>
          )
        })}
      </section>

      <section className="filtros" aria-label="Filtros do ranking">
        <label>
          Área de Resultado
          <select value={area} onChange={(evento) => setArea(evento.target.value)}>
            <option value="Todas">Todas as áreas</option>
            {areas.map((item) => <option key={item} value={item}>{nomeArea(item)}</option>)}
          </select>
        </label>

        <label>
          Tipo
          <select value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
            <option value="Todos">Todos</option>
            {tipos.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>

        <label>
          Origem
          <select value={origem} onChange={(evento) => setOrigem(evento.target.value)}>
            <option value="Todas">Todas</option>
            {origens.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>

        <label className="busca">
          Buscar tema
          <input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Ex.: logística, saúde, turismo"
          />
        </label>
      </section>

      {visao === 'Resumo' && <>
        <section className="titulo-secao">
          <div>
            <span className="etiqueta">VISÃO GERAL</span>
            <h2>Panorama do recorte selecionado</h2>
          </div>
          <p>Leitura sintética da composição da base e das prioridades mais bem posicionadas.</p>
        </section>

        <section className="cards">
          <article className="card-kpi card-kpi--vermelho">
            <span>Registros no recorte</span>
            <strong>{filtrados.length}</strong>
          </article>
          <article className="card-kpi card-kpi--turquesa">
            <span>Ativos</span>
            <strong>{filtrados.filter((r) => texto(r.Tipo) === 'Ativo').length}</strong>
          </article>
          <article className="card-kpi card-kpi--laranja">
            <span>Passivos</span>
            <strong>{filtrados.filter((r) => texto(r.Tipo) === 'Passivo').length}</strong>
          </article>
          <article className="card-kpi card-kpi--amarelo">
            <span>Propostas</span>
            <strong>{filtrados.filter((r) => texto(r.Tipo) === 'Proposta').length}</strong>
          </article>
        </section>

        <section className="grade-graficos">
          <article className="cartao">
            <div className="cartao-titulo">
              <span className="barra-titulo barra-titulo--turquesa" />
              <div>
                <h2>Registros por Área de Resultado</h2>
                <p>Distribuição do recorte atual entre as cinco áreas estratégicas.</p>
              </div>
            </div>
            <ReactECharts option={graficoArea} style={{ height: 340 }} />
          </article>

          <article className="cartao">
            <div className="cartao-titulo">
              <span className="barra-titulo barra-titulo--vermelho" />
              <div>
                <h2>Composição do recorte</h2>
                <p>Participação de ativos, passivos e propostas na seleção atual.</p>
              </div>
            </div>
            <ReactECharts option={graficoTipo} style={{ height: 340 }} />
          </article>
        </section>

        <section className="cartao">
          <div className="cartao-titulo">
            <span className="barra-titulo barra-titulo--amarelo" />
            <div>
              <h2>Top 10 prioridades do recorte</h2>
              <p>Dez registros com maior score final após a aplicação dos filtros.</p>
            </div>
          </div>
          <TabelaRanking registros={top10} />
        </section>
      </>}

      {visao === 'Ranking' && (
        <section className="cartao">
          <div className="cartao-titulo">
            <span className="barra-titulo barra-titulo--vermelho" />
            <div>
              <h2>Ranking integrado</h2>
              <p>Ordenado pelo score final. Use os filtros para comparar áreas, tipos e entidades.</p>
            </div>
          </div>

          <div className="ranking-controles">
            <div className="ranking-resumo">
              <span>
                <strong>{totalRegistrosRanking}</strong> registro(s) encontrado(s)
              </span>
              <small>
                Ordenação: {campoOrdenacao === 'Score final (0–100)' ? 'Score' : campoOrdenacao}
                {' · '}
                {direcaoOrdenacao === 'asc' ? 'crescente' : 'decrescente'}
              </small>
            </div>

            <div className="ranking-acoes">
              <button
                type="button"
                className="botao-exportar"
                onClick={() => baixarCsv(rankingOrdenado)}
                disabled={totalRegistrosRanking === 0}
              >
                ↓ Exportar CSV
              </button>

              <label>
                Exibir
                <select
                  value={itensPorPagina}
                  onChange={(evento) => setItensPorPagina(Number(evento.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                por página
              </label>
            </div>
          </div>

          <TabelaRanking
            registros={rankingPaginado}
            campoOrdenacao={campoOrdenacao}
            direcaoOrdenacao={direcaoOrdenacao}
            aoOrdenar={ordenarRanking}
          />

          <div className="paginacao">
            <span>
              Mostrando {totalRegistrosRanking === 0 ? 0 : inicioPagina + 1}–
              {Math.min(fimPagina, totalRegistrosRanking)} de {totalRegistrosRanking}
            </span>

            <div className="paginacao-acoes">
              <button
                type="button"
                onClick={() => setPaginaAtual((pagina) => Math.max(1, pagina - 1))}
                disabled={paginaAtual === 1}
                aria-label="Página anterior"
              >
                ←
              </button>

              <div className="paginacao-paginas" aria-label="Páginas do ranking">
                {paginasRanking.map((item, indice) =>
                  item === '…'
                    ? <span className="reticencias" key={`reticencias-${indice}`}>…</span>
                    : (
                      <button
                        type="button"
                        key={item}
                        className={`pagina-numero ${item === paginaAtual ? 'ativa' : ''}`}
                        onClick={() => setPaginaAtual(item)}
                        aria-current={item === paginaAtual ? 'page' : undefined}
                      >
                        {item}
                      </button>
                    ),
                )}
              </div>

              <button
                type="button"
                onClick={() => setPaginaAtual((pagina) => Math.min(totalPaginasRanking, pagina + 1))}
                disabled={paginaAtual >= totalPaginasRanking}
                aria-label="Próxima página"
              >
                →
              </button>
            </div>
          </div>
        </section>
      )}

      {visao === 'Escuta' && (
        <section className="cartao">
          <div className="cartao-titulo">
            <span className="barra-titulo barra-titulo--turquesa" />
            <div>
              <h2>Escuta técnica das Câmaras</h2>
              <p>A votação é uma dimensão do ranking e não substitui evidência documental ou análise de viabilidade.</p>
            </div>
          </div>

          <ReactECharts option={graficoEscuta} style={{ height: 430 }} />

          <TabelaRanking
            registros={escutaOrdenada.map((registro, indice) => ({
              'Posição': indice + 1,
              'Tema, ativo ou passivo': registro['Tema, ativo ou passivo identificado'],
              'Área de resultado': registro['Área de resultado'],
              Tipo: registro.Tipo,
              Origem: 'Escuta Técnica',
              'Score final (0–100)': selecoesDaEscuta(registro),
              Prioridade: registro['Prioridade na escuta'],
              'Grau de factibilidade': 'Não classificada',
              'Desafio(s) do Plano': registro['Desafio do Plano relacionado'],
              'Indicador do Plano associado': registro['Indicador do Plano associado'],
              'Fonte e localização': registro['Fonte e localização'],
            }))}
          />
        </section>
      )}

      {visao === 'Lacunas' && (
        <section className="cartao">
          <div className="cartao-titulo">
            <span className="barra-titulo barra-titulo--laranja" />
            <div>
              <h2>Sistemas de referência para lacunas</h2>
              <p>Referências de monitoramento e benchmark associadas ao processo de revisão.</p>
            </div>
          </div>

          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Sistema / painel</th>
                  <th>Instituição</th>
                  <th>Lacunas atendidas</th>
                  <th>Aplicação</th>
                </tr>
              </thead>
              <tbody>
                {lacunas.map((registro) => (
                  <tr key={texto(registro['Sistema / painel'])}>
                    <td>{texto(registro.Estado)}</td>
                    <td><strong>{texto(registro['Sistema / painel'])}</strong></td>
                    <td>{texto(registro['Instituição responsável'])}</td>
                    <td>{texto(registro['Lacunas atendidas'])}</td>
                    <td>{texto(registro['Aplicação no DataIMESC / Maranhão 2050'])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {visao === 'Método' && (
        <section className="cartao">
          <div className="cartao-titulo">
            <span className="barra-titulo barra-titulo--amarelo" />
            <div>
              <h2>Como o ranking é calculado</h2>
              <p>Composição dos quatro componentes que formam o score integrado.</p>
            </div>
          </div>

          <div className="pesos">
            <article style={{ borderTopColor: CORES_IDENTIDADE.vermelho }}>
              <strong>40%</strong>
              <span>Adesão aos desafios e maturidade de monitoramento</span>
            </article>
            <article style={{ borderTopColor: CORES_IDENTIDADE.turquesa }}>
              <strong>25%</strong>
              <span>Votação e contribuição da escuta</span>
            </article>
            <article style={{ borderTopColor: CORES_IDENTIDADE.amarelo }}>
              <strong>20%</strong>
              <span>Qualidade das informações</span>
            </article>
            <article style={{ borderTopColor: CORES_IDENTIDADE.laranja }}>
              <strong>15%</strong>
              <span>Factibilidade fiscal orientativa</span>
            </article>
          </div>

          <aside className="aviso">
            <strong>Leitura necessária.</strong> {metadados.metodologia.nota}
          </aside>
        </section>
      )}

      <footer className="rodape">
        <span>Plano Maranhão 2050</span>
        <span>Monitoramento · revisão · priorização estratégica</span>
      </footer>
    </main>
  )
}

export default App
