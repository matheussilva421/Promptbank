// ── Config ──
    const LS_KEY_V3 = "bancoPrompts_v3";
    const LS_KEY_V2 = "bancoPrompts_v2";

    const CATS = [
      { id: "todos", name: "Todos os Prompts", icon: "🗂️", desc: "Todos os prompts em um lugar" },
      { id: "analise", name: "Análise por Eixo", icon: "⚡", desc: "Análise detalhada por eixo" },
      { id: "triagem", name: "Triagem", icon: "🧭", desc: "Prompts para triagem e leitura inicial" },
      { id: "diligencias", name: "Diligências", icon: "📬", desc: "Reanálises e pós-diligência" },
      { id: "geral", name: "Análise", icon: "🏛️", desc: "Análise geral de processos" },
      { id: "informacao", name: "Informação Técnica", icon: "📝", desc: "Templates e prompts para redação de IT" },
      { id: "especiais", name: "Casos Especiais", icon: "🚨", desc: "Cenários específicos e exceções" },
      { id: "arquivados", name: "Arquivados", icon: "🗃️", desc: "Prompts antigos ou substituídos" },
    ];

    const EDITABLE_CATS = CATS.filter(c => c.id !== "todos" && c.id !== "arquivados");

    const SUBCATS = [
      { id: "eixo1", name: "Eixo 1", desc: "Qualidade de Segurado do RPPS" },
      { id: "eixo3", name: "Eixo 3", desc: "Requisitos / Tempo / Compensação" },
      { id: "eixo4", name: "Eixo 4", desc: "Composição e Cálculo do Benefício" },
      { id: "eixo5", name: "Eixo 5", desc: "Implantação do Benefício" },
    ];

    const FORMATO_LABELS = {
      "compacto": "⚡ Compacto", "mestre": "🧠 Mestre", "paragrafo": "✍️ Parágrafo",
      "pente-fino": "🔬 Pente-fino", "redacao-final": "📄 Redação Final", "checklist": "☑️ Checklist"
    };
    const STATUS_LABELS = {
      "homologado": "✅ Homologado", "teste": "🧪 Em teste", "variante": "🔁 Variante", "arquivado": "🗃️ Arquivado"
    };