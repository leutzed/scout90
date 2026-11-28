# Scout90

[Abrir o painel](https://leutzed.github.io/scout90/)

Cada campeonato e temporada tem um JSON consolidado. A base inicial do Brasileirão Série A 2026 tem 734 jogadores. As oito partes originais estão em `brasileirao-serie-a-2026-originais.zip`.

## Publicar um campeonato

No painel, abra **Importar base**, selecione todas as partes da mesma exportação e informe o campeonato e a temporada. Marque **Salvar também no GitHub** para publicar o lote. O painel valida a paginação e salva os originais, o consolidado e o catálogo em um único commit na branch `main`. Revisões anteriores dos originais continuam no repositório.

Use um [token fine-grained](https://github.com/settings/personal-access-tokens/new) com acesso apenas a `leutzed/scout90` e **Contents: Read and write**. O painel usa o token diretamente na API do GitHub e não o grava. Os arquivos enviados ao repositório são públicos e aparecem no seletor depois da implantação do GitHub Pages.

Para uso local, importe sem marcar a opção do GitHub. Use **Baixar JSON** para exportar as estatísticas da base ativa. Fichas e anotações ficam no navegador.

## Perfis de jogadores

O painel lê os dados em `results[].player.profile` de uma base de campeonato. Para complementar bases já carregadas, use **Importar perfis** com o `perfis.json` do agente ou com os JSONs individuais. O cruzamento usa o ID do jogador. Perfis importados por esse botão ficam no navegador.

Os filtros aceitam nacionalidade, intervalo de nascimento, pé preferido e altura em centímetros. As bandeiras são do [Flagpedia](https://flagpedia.net/download/icons).

## Métricas derivadas e estrutura

O ranking calcula participações em gols, minutos por ação, diferença entre gols e xG e métricas de goleiros e custos conforme a cobertura de cada base. O xG sem pênalti desconta 0,79 por cobrança e tem piso zero. As contagens estimadas de cruzamentos, dribles, bolas longas e duelos ficam disponíveis quando o percentual arredondado permite identificar um único total. Campos sem dados ou razões sem denominador aparecem como —.

O HTML carrega o estilo em `scout90.css` e arquivos JavaScript por responsabilidade: estado, perfis, métricas, gráficos, interface, biblioteca de competições e publicação no GitHub. As bandeiras estão em um arquivo de dados separado.

## Jogadores semelhantes

Abra **Semelhantes** ou clique em **Encontrar semelhantes** na ficha de um jogador. O gráfico lista até dez candidatos da competição e temporada ativas. A pontuação usa a distância entre percentis no perfil selecionado e reduz a nota se faltarem métricas do candidato. Use **Comparar** para abrir os dois jogadores lado a lado.

Em **Comparação por métrica**, selecione um dos candidatos para ver os valores e percentis que entraram na nota.

## Explorar jogadores

A aba **Explorar** combina posição e minutos mínimos com dispersão por quadrantes e distribuição por métrica. As medianas da dispersão são calculadas com os registros que têm valores para os dois eixos. O histograma mostra a mediana e o intervalo P25–P75. Use o seletor ou os pontos da dispersão para destacar jogadores e adicioná-los ao Comparador.

Marque as caixas de seleção no ranking e clique em **Ver mapa de calor** para comparar os candidatos. Os percentis usam o recorte da aba Explorar. Os perfis de idade e valor de mercado dependem das fichas disponíveis. A idade usa 31 de dezembro em temporadas de ano único ou 30 de junho do último ano em temporadas divididas. O valor de mercado estimado mantém a moeda original.

## Todas as ligas

A busca global usa um índice compacto por competição e temporada. O padrão é a temporada mais recente disponível de cada liga. A tabela preserva os registros por clube e indica a competição e a temporada. Abra um jogador para navegar pelos recortes do mesmo ID ou marque de dois a quatro registros para comparar as estatísticas completas.

A importação pela interface publica índice, consolidado, partes originais e catálogo no mesmo commit. Se você alterar estatísticas ou fichas diretamente pelo Git, rode `node scripts/update-search-index.cjs` antes de publicar e inclua os índices alterados e `campeonatos.json` no commit. O navegador consulta o consolidado individual quando uma entrada ainda não tem índice.
