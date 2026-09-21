# Painel Maranhão 2050

Este projeto transforma a matriz de contribuições em um painel web estático e interativo.

Fluxo de atualização:

`Matriz Excel → script Python → JSON público → painel React/Vite → GitHub Actions → GitHub Pages`

O Excel continua sendo a fonte oficial e auditável. O painel apenas mostra a versão já validada dos dados.

## 1. O que este pacote entrega

- Exportação automática das abas `Ranking Integrado`, `Escuta Técnica`, `Lacunas Indicadores` e `SEFAZ`.
- Validação dos cabeçalhos da matriz antes de gerar os arquivos públicos.
- Painel com resumo, ranking, escuta, lacunas e metodologia.
- Filtros por área de resultado, tipo, origem e texto.
- Arquivo de publicação automática para GitHub Pages.

O script foi validado com a matriz que contém 210 registros no ranking integrado, 37 registros de escuta, 25 sistemas de referência de lacunas e 6 evidências SEFAZ.

## 2. Antes de começar

Instale no computador:

1. Git.
2. Node.js LTS.
3. Python 3.11 ou superior. O ambiente já utilizado para os indicadores pode ser reaproveitado.
4. Visual Studio Code.

Descompacte este pacote em uma pasta de trabalho, por exemplo:

```text
C:\Users\talysson.bastos\Desktop\maranhao2050-painel
```

Abra essa pasta no VS Code com `File > Open Folder`.

## 3. Preparar o ambiente Python

No terminal PowerShell aberto na raiz do projeto, execute:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Se já houver um ambiente virtual funcional no projeto de indicadores, você pode usar o Python dele no lugar de criar outro.

## 4. Inserir a matriz oficial

Copie a versão validada do arquivo para a pasta abaixo, mantendo exatamente este nome:

```text
data\origem\Matriz_contribuicoes_entidades_Plano_Maranhao_2050_atualizada (3).xlsx
```

Esse arquivo está no `.gitignore`. Ele fica local e não entra no repositório nem no site publicado.

## 5. Gerar os dados públicos do painel

Ainda na raiz do projeto, execute:

```powershell
.\.venv\Scripts\python.exe scripts\exportar_matriz.py
```

O script cria quatro arquivos em `web\public\data`:

```text
ranking-integrado.json
escuta-tecnica.json
lacunas-indicadores.json
sefaz.json
metadados.json
```

Resultado esperado para a matriz atual:

```text
ranking-integrado: 210 registro(s)
escuta-tecnica: 37 registro(s)
lacunas-indicadores: 25 registro(s)
sefaz: 6 registro(s)
```

Se a estrutura de alguma aba mudar, o processo para com mensagem de erro. Corrija primeiro a matriz ou, se a alteração for deliberada, atualize a configuração `ABAS` em `scripts/exportar_matriz.py`.

## 6. Preparar e testar o painel no computador

Entre na pasta web e instale as dependências:

```powershell
cd web
npm install
npm run dev
```

Abra o endereço mostrado no terminal, normalmente `http://localhost:5173/`.

Verifique os seguintes itens antes de publicar:

1. O total do ranking corresponde ao Excel.
2. Os filtros retornam registros coerentes.
3. O topo do ranking, a escuta e as lacunas exibem a fonte e os vínculos corretos.
4. A aba Método preserva os pesos: 40% adesão/maturidade, 25% escuta, 20% qualidade e 15% factibilidade fiscal orientativa.
5. Nenhum conteúdo sensível aparece nos arquivos JSON.

Para gerar a versão de produção e testar se há erro de código:

```powershell
npm run build
npm run preview
```

## 7. Personalizar o endereço do GitHub Pages

O pacote parte do nome de repositório `maranhao2050-painel`. Se usar outro nome, altere uma única linha no arquivo `web\vite.config.ts`:

```ts
base: process.env.GITHUB_ACTIONS ? '/NOME-DO-REPOSITORIO/' : '/',
```

Se o painel for publicado em domínio próprio, como `painel.ma.gov.br`, use:

```ts
base: '/',
```

## 8. Criar e conectar o repositório no GitHub

No GitHub, crie um repositório chamado `maranhao2050-painel`. Recomenda-se iniciar como privado enquanto a equipe revisa o código e os dados publicados.

No terminal, de volta à raiz do projeto, execute:

```powershell
cd ..
git init
git branch -M main
git add .
git commit -m "Cria painel inicial do Maranhão 2050"
git remote add origin https://github.com/SEU-USUARIO-OU-ORGANIZACAO/maranhao2050-painel.git
git push -u origin main
```

Substitua `SEU-USUARIO-OU-ORGANIZACAO` pelo usuário ou organização responsável pelo repositório.

## 9. Ativar a publicação automática

No repositório GitHub:

1. Acesse `Settings`.
2. Abra `Pages`.
3. Em `Build and deployment`, escolha `GitHub Actions`.
4. Faça um novo `git push` ou execute manualmente o fluxo na aba `Actions`.

O arquivo `.github/workflows/deploy.yml` instala o painel, executa o build e publica o conteúdo da pasta `web/dist` a cada atualização da branch `main`.

## 10. Rotina de atualização da matriz

Sempre que houver uma nova versão validada:

```powershell
# 1. Substitua apenas o arquivo local em data\origem.

# 2. Gere a nova versão pública.
.\.venv\Scripts\python.exe scripts\exportar_matriz.py

# 3. Teste o painel.
cd web
npm run build
cd ..

# 4. Revise somente os dados que serão publicados.
git diff -- web/public/data

# 5. Versione e publique.
git add web/public/data
git commit -m "Atualiza matriz de contribuições"
git push
```

O GitHub Actions publicará automaticamente a nova versão do painel.

## 11. Regra de segurança e método

GitHub Pages é público. Mesmo que o repositório seja privado, trate todo arquivo colocado em `web/public/data` como informação publicável.

Não publique os PDFs de origem, respostas identificadas do formulário, dados pessoais ou versões brutas das contribuições. O painel deve expor somente a matriz consolidada e autorizada.

Também mantenha explícito no painel:

- Os códigos D das lacunas não foram vinculados artificialmente aos 22 desafios.
- A SEFAZ é referência orientativa de saúde fiscal por área. Ela não substitui orçamento, EVTEA ou avaliação setorial.
- O ranking apoia a decisão e deve ser validado pelas instâncias técnicas competentes.

## 12. Arquivos principais

```text
scripts/exportar_matriz.py       Lê e valida a matriz Excel.
web/src/App.tsx                  Interface, filtros e gráficos.
web/src/index.css                Identidade visual responsiva.
web/public/data/*.json           Dados publicados pelo painel.
.github/workflows/deploy.yml     Publicação automática no GitHub Pages.
```
