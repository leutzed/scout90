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
