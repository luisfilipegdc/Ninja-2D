# Catálogo de vieses e gatilhos

Use ao montar as recomendações (passo 4 do método). Para cada item: o que é, **como
aplicar** em produto/UI, e **onde vira dark pattern**. Escolha poucos e certeiros — empilhar
gatilhos gera ruído e desconfiança. Todo elemento aplicado precisa de **intenção**: um
benefício real para quem decide.

> Honestidade: a maioria destes vieses é patrimônio do campo (Kahneman, Cialdini, Thaler).
> O valor do método Rian é a curadoria + aplicação a UX + o portão ético. Não os apresente
> como invenção dele.

## Índice
1. Decisão e valor — ancoragem, contraste, enquadramento, isca, paralisia por análise
2. Risco e urgência — aversão à perda, escassez
3. Social e confiança — prova social, efeito adesão, autoridade, reciprocidade
4. Memória e familiaridade — mera exposição, disponibilidade, dotação
5. Percepção e controle — ilusão de controle, viés de confirmação, tempo psicológico

---

## 1. Decisão e valor

### Ancoragem
- **O que é:** o primeiro número/opção apresentado condiciona os julgamentos seguintes.
- **Aplicar:** mostrar o plano/preço mais alto primeiro faz os demais parecerem razoáveis;
  exibir um "de R$X por R$Y" verdadeiro; sugerir um valor de referência em doações.
- **Dark pattern:** preço "de" fictício/inflado que nunca foi praticado.

### Contraste (psicologia do contraste)
- **O que é:** percepção é relativa; um elemento se destaca pelo que está ao redor.
- **Aplicar:** dar peso visual ao CTA/opção recomendada; isolar a ação principal.
- **Dark pattern:** ofuscar a opção legítima (ex.: "cancelar" cinza-claro quase invisível).

### Enquadramento (framing)
- **O que é:** a mesma informação gera reações diferentes conforme é apresentada.
- **Aplicar:** "95% sem gordura" > "5% de gordura"; "economize 20% no anual"; selo
  "Mais popular"; mostrar o benefício junto ao preço.
- **Dark pattern:** enquadrar para esconder o custo real ou induzir leitura falsa.

### Efeito isca (decoy)
- **O que é:** uma terceira opção propositalmente pior torna a opção-alvo mais atraente.
- **Aplicar:** estruturar planos para que o "ideal" pareça o melhor custo-benefício.
- **Dark pattern:** isca que existe só pra manipular, sem nenhum valor para ninguém.

### Paralisia por análise (excesso de opções / pânico decisório)
- **O que é:** opções demais travam a decisão e aumentam o abandono.
- **Aplicar:** reduzir o número de escolhas; destacar uma recomendação; usar defaults sensatos.
- **Dark pattern:** sobrecarregar de propósito pra empurrar o caminho que te favorece.

---

## 2. Risco e urgência

### Aversão à perda
- **O que é:** a dor de perder pesa mais que o prazer de ganhar o equivalente.
- **Aplicar:** mostrar o que se perde ao não agir ("seu progresso/carrinho será perdido"),
  trials que destacam o que termina, lembretes de benefício a expirar — **quando reais**.
- **Dark pattern:** "você vai perder pra sempre!" sobre algo que não se perde.

### Escassez
- **O que é:** o que é percebido como raro vale mais.
- **Aplicar:** estoque/vagas/prazo limitados **verdadeiros** ("restam 3 a este preço").
- **Dark pattern:** escassez fabricada (contador que reinicia, "último item" perpétuo).

---

## 3. Social e confiança

### Prova social
- **O que é:** na incerteza, copiamos o comportamento dos outros.
- **Aplicar:** avaliações, depoimentos reais, número de usuários, "X compraram hoje".
- **Dark pattern:** reviews falsos, números inventados.

### Efeito adesão (bandwagon)
- **O que é:** tendência a fazer o que a maioria faz.
- **Aplicar:** destacar o plano mais escolhido, contagem de adoção, selos de comunidade.
- **Dark pattern:** inflar métricas de popularidade.

### Autoridade
- **O que é:** damos mais crédito a especialistas e fontes reconhecidas.
- **Aplicar:** credenciais, certificações, selos, endossos verificáveis.
- **Dark pattern:** autoridade fabricada ("jaleco" falso, selo sem lastro).

### Reciprocidade
- **O que é:** sentimos necessidade de retribuir o que recebemos.
- **Aplicar:** amostra, e-book, trial ou ferramenta gratuita genuinamente útil antes de pedir.
- **Dark pattern:** "presente" que cria obrigação coercitiva ou esconde uma assinatura.

---

## 4. Memória e familiaridade

### Mera exposição
- **O que é:** preferimos o que vemos com frequência.
- **Aplicar:** consistência de marca/linguagem em todos os pontos de contato.
- **Dark pattern:** bombardeio/spam, repetição intrusiva.

### Heurística da disponibilidade
- **O que é:** julgamos pela facilidade com que um exemplo vem à mente.
- **Aplicar:** tornar o caminho desejado o mais visível e memorável; exemplos concretos.
- **Dark pattern:** distorcer a percepção de risco/benefício com exemplos enviesados.

### Efeito de dotação (endowment)
- **O que é:** valorizamos mais o que sentimos como "nosso".
- **Aplicar:** personalização, trials que dão sensação de posse, configurar antes de pagar.
- **Dark pattern:** criar a sensação de posse e dificultar o cancelamento.

---

## 5. Percepção e controle

### Ilusão de controle
- **O que é:** sensação de comando aumenta conforto e engajamento.
- **Aplicar:** dar opções reais, preferências, feedback de ações, possibilidade de desfazer.
- **Dark pattern:** controle ilusório (botões que fingem ajustar algo).

### Viés de confirmação
- **O que é:** buscamos o que confirma o que já acreditamos.
- **Aplicar:** apresentar informação equilibrada; não reforçar estereótipos prejudiciais.
- **Dark pattern:** alimentar crenças falsas para manter engajamento.

### Tempo psicológico (percepção da espera)
- **O que é:** a espera "pesa" mais quando é vazia e sem feedback.
- **Aplicar:** loaders com progresso, skeletons, microcopy durante a espera, animação de
  transição que ocupa o tempo de carregamento — a espera **parece** menor.
- **Dark pattern:** fingir processamento longo pra dar falsa sensação de esforço/valor.

---

## Como escolher (regra prática)
Para cada ponto de fricção/conversão, pergunte: **qual viés a pessoa já está vivendo aqui?**
(insegurança → prova social/autoridade; comparação → ancoragem/contraste; medo de errar →
aversão à perda + opção de desfazer; espera → tempo psicológico). Aplique o que **encaixa no
estado mental real**, não o que parece mais "forte". Um gatilho certo > três genéricos.
