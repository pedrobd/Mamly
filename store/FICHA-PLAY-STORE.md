# Mamly na Google Play: textos e respostas

As imagens estão em `store/out/`:
- `icon-512.png`: ícone da app (512×512)
- `pt-PT/feature-graphic.png` e `en-US/feature-graphic.png`: gráfico de destaque (1024×500)
- `pt-PT/screenshot-1…5.png` e `en-US/screenshot-1…5.png`: capturas de ecrã do telemóvel (1080×1920)

Para gerar as imagens outra vez: `node store/gen.js`

---

## 1. Criar a app

| Campo | Resposta |
|---|---|
| Nome da app | **Mamly** |
| Idioma predefinido | Português (Portugal) – pt-PT |
| App ou jogo | App |
| Grátis ou paga | Grátis |

---

## 2. Ficha da loja principal: Português (pt-PT)

**Nome:** Mamly – Lembretes por voz

**Descrição breve** (máx. 80 carateres)
> Lembretes falados para quem tem PHDA. Diz, e ela lembra-te em voz alta.

**Descrição completa**
```
O Mamly é a mãe que te lembra de tudo. Em voz alta.

Esqueces-te das coisas assim que pousas o telemóvel? O Mamly foi pensado para cabeças com PHDA: dizes o que tens de fazer, como dirias a alguém, e ele avisa-te em voz alta à hora certa, mesmo com o ecrã bloqueado.

🗣️ DIZ, NÃO ESCREVAS
Carrega no microfone e fala naturalmente:
• «De 30 em 30 minutos das 13h às 17h avisa-me para pagar a conta da luz»
• «Lembra-me de beber água de meia em meia hora até às 22h»
• «Daqui a 20 minutos tira a roupa da máquina»
O Mamly percebe a hora, a repetição e até quando deves parar.

🔔 AVISOS QUE NÃO PASSAM DESPERCEBIDOS
• Fala contigo em voz alta, mesmo com o telemóvel bloqueado
• Aviso em ecrã inteiro, com um botão «Feito» enorme
• Adia 10 ou 30 minutos com um toque, ou responde por voz: «feito», «adia 15 minutos»
• Pode usar o volume do alarme, para ouvires mesmo em silêncio

💛 MODO MÃE
Liga o modo mãe e a voz fala como uma mãe carinhosa (e um bocadinho insistente): «Meu amor, não te esqueças…»

🔗 PARTILHA COM QUEM GOSTAS
Envia um lembrete por link (por WhatsApp, por exemplo). Quem o recebe adiciona-o com um toque.

🔒 PRIVADO DE RAIZ
Sem contas, sem anúncios, sem servidores. Os teus lembretes ficam só no teu telemóvel.

✨ E MAIS
• Modo escuro
• Escolhe a voz e a velocidade
• Diz-lhe o teu nome e ela chama-te por ele
• Funciona em português e em inglês

Feito em Portugal, por alguém que também se esquece das coisas.
Dúvidas ou sugestões: ola@mamly.app
```

---

## 3. Ficha em inglês (en-US)

Para adicionar: Ficha da loja principal → **Gerir traduções** → Adicionar as suas próprias traduções → English (United States) – en-US.

**Name:** Mamly – Voice reminders

**Short description**
> Spoken reminders for ADHD brains. Say it, and she'll remind you out loud.

**Full description**
```
Mamly is the mom who reminds you of everything. Out loud.

Forget things the moment you put your phone down? Mamly was made for ADHD brains: just say what you need to do, the way you'd tell a friend, and it reminds you out loud right on time, even when your phone is locked.

🗣️ SAY IT, DON'T TYPE IT
Tap the mic and talk naturally:
• "Every 30 minutes from 1pm to 5pm remind me to pay the electricity bill"
• "Remind me to drink water every half hour until 10pm"
• "In 20 minutes, take the laundry out"
Mamly understands the time, how often to repeat and when to stop.

🔔 REMINDERS YOU WON'T MISS
• Speaks to you out loud, even with the screen locked
• Full-screen alert with a huge "Done" button
• Snooze 10 or 30 minutes with one tap, or reply by voice: "done", "snooze 15 minutes"
• Can use alarm volume, so you hear it even on silent

💛 MOM MODE
Turn on mom mode and the voice talks like a caring (and slightly persistent) mom: "Sweetheart, don't forget…"

🔗 SHARE WITH THE PEOPLE YOU LOVE
Send a reminder as a link (on WhatsApp, for example). Whoever gets it adds it with one tap.

🔒 PRIVATE BY DESIGN
No accounts, no ads, no servers. Your reminders stay on your phone.

✨ AND MORE
• Dark mode
• Pick the voice and speed
• Tell it your name and it'll call you by it
• Works in English and Portuguese

Made in Portugal, by someone who forgets things too.
Questions or ideas: hello@mamly.app
```

---

## 4. Definições da loja

| Campo | Resposta |
|---|---|
| Categoria | **Produtividade** |
| Etiquetas | Lembretes, Produtividade, Organização |
| Email | ola@mamly.app |
| Website | https://mamly.app |
| Telefone | (deixa vazio) |

---

## 5. Conteúdo da app (Política → Conteúdo da app)

**Política de privacidade:** `https://mamly.app/privacidade.html`

**Acesso à app:** «Todas as funcionalidades estão disponíveis sem acesso especial» (não há login).

**Anúncios:** «Não, a minha app não contém anúncios».
- ⚠️ Quando entrar o primeiro apoiante (logo em `web/supporters.js`), muda para **«Sim, a minha app contém anúncios»** e atualiza a política de privacidade (secção 1 e resumo). A segurança dos dados continua igual: não há SDK de anúncios nem recolha de dados.

**Classificação de conteúdo** (questionário)
- Email: ola@mamly.app
- Categoria: **Todos os outros tipos de apps** (utilidade, produtividade, comunicação…)
- Responde **Não** a todas as perguntas: violência, sexo, linguagem, drogas, jogos de azar, etc.
- «Os utilizadores podem interagir ou trocar conteúdo?» → **Não**. A partilha é feita por apps externas, como o WhatsApp.
- «Partilha a localização?» → **Não**. «Permite compras digitais?» → **Não**.

**Público-alvo:** **18 anos ou mais**. «A app pode atrair crianças?» → **Não**.

**Segurança dos dados**
- «A sua app recolhe ou partilha algum dos tipos de dados de utilizadores obrigatórios?» → **Não**
- Isto é verdade porque os dados ficam só no telemóvel e a app não os envia para lado nenhum. O reconhecimento de voz é feito pelo serviço do próprio Android, não pela app.

**Apps de notícias / governamentais / financeiras / COVID:** **Não** a tudo.

**Saúde:** «A minha app não tem funcionalidades de saúde». É uma app de produtividade.

**Permissões de alarme exato (USE_EXACT_ALARM)**
- Escolhe: **«Despertador ou calendário / lembretes»**. A função principal da app é tocar avisos a horas exatas.

**Intenções em ecrã inteiro (USE_FULL_SCREEN_INTENT)**
- Escolhe: **«Despertador»** (a app mostra o aviso por cima do ecrã de bloqueio à hora marcada, como um despertador).
- Se a Google não aprovar, a app continua a funcionar: no Android 14+ a pessoa ativa «Permitir notificações em ecrã inteiro» (a app mostra um botão para isso) ou desliga a opção nas definições.

**Serviços em primeiro plano (Foreground service – mediaPlayback)**
- Tipo: **Reprodução de multimédia**
- Descrição (podes colar):
  > O Mamly lê os lembretes em voz alta (texto para voz) à hora marcada, incluindo com o ecrã bloqueado. O serviço em primeiro plano só está ativo enquanto o aviso está a ser falado e termina logo a seguir.
- A Google pede um **vídeo** (YouTube, como «Não listado») com 20–30 segundos:
  1. Criar um lembrete «daqui a 1 minuto»
  2. Bloquear o ecrã
  3. Mostrar o aviso a ser falado com a notificação visível

---

## 6. Assinatura da app (Play App Signing)

Quando carregares o primeiro **.aab**, escolhe **«Deixar a Google gerar e gerir a chave de assinatura»** (é a opção recomendada).
- A nossa chave (a que está cifrada no GitHub) passa a ser a **chave de carregamento**. É com ela que o GitHub assina cada nova versão.
- ⚠️ Quem instalou o APK do link antigo tem de **desinstalar** antes de instalar pela Play Store, porque a assinatura é diferente. Os lembretes antigos perdem-se.

O ficheiro **.aab** está em GitHub → pedrobd/mamly → Actions → última execução → Artifacts → **Mamly-aab-play-store** (vem num .zip; tira o .aab de dentro).

---

## 7. Teste fechado obrigatório (contas pessoais)

Antes de publicar para toda a gente, a Google exige um **teste fechado com pelo menos 12 testadores durante 14 dias seguidos**.
1. Testar e lançar → Testes → **Teste fechado** → Criar faixa
2. Testadores: cria uma lista de emails (as contas Google dos testadores). O grupo de PHDA é perfeito.
3. Carrega o .aab, dá-lhe o nome «2.6» e envia para revisão
4. Partilha com os testadores o **link de adesão**. Cada um tem de aceitar e instalar.
5. Passados 14 dias, pede acesso à **produção** (a Google faz umas perguntas sobre o teste).

Dica: pede aos testadores que **mantenham a app instalada** durante os 14 dias e que a abram de vez em quando.
