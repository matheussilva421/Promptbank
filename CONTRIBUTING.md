# Contribuindo com o Promptbank

## Fluxo recomendado
1. Abra uma issue (bug/feature) usando os templates.
2. Crie PR pequeno e objetivo.
3. Descreva risco e plano de rollback.
4. Inclua evidências de teste e screenshot para alterações visuais.

## Padrões de qualidade
- Preserve compatibilidade com dados v2/v3 quando possível.
- Evite quebrar os fluxos de sync (Drive/Cloudflare).
- Mantenha mensagens e labels em PT-BR, como no restante do projeto.

## Checklist mínimo antes do merge
- App abre sem erros no console.
- Busca e filtros funcionam.
- Editor salva/edita/exclui corretamente.
- Export/Import continuam operacionais.

## Rollout de interface (legacy → redesign)
Use a flag global `uiVersion` em `js/config.js` para liberar visual novo por etapas, com rollback simples para `legacy`.

Fases sugeridas:
1. shell + tokens
2. filtros + toolbar
3. cards + KPIs
4. polimento/responsividade/acessibilidade

## Checklist de regressão manual (por fase)
- criar/editar/excluir prompt
- copiar/duplicar
- importar/exportar
- sincronização
- busca/filtros/ordenação
- tema claro/escuro
