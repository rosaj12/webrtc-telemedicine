# TeleMed 1.0 — Protótipo experimental WebRTC

> Projeto educacional de comunicação de áudio e vídeo entre dois participantes. **Não é um sistema de telemedicina para uso clínico real.** Não utilize dados reais de pacientes.

## Visão geral

O TeleMed demonstra uma consulta simulada entre dois participantes, usando WebRTC para áudio e vídeo e WebSocket para troca de mensagens de sinalização. O projeto foi validado em ambiente local, com duas janelas ou navegadores.

## Tecnologias

- **Frontend:** HTML, CSS e JavaScript (módulos ES).
- **Mídia e comunicação:** WebRTC (`RTCPeerConnection`, captura de câmera e microfone).
- **Sinalização:** WebSocket com a biblioteca `ws` no Node.js.
- **Backend:** Node.js, servidor HTTP e gerenciamento de salas.
- **TLS:** suporte opcional a HTTPS/WSS, desativado nos testes locais.

## Organização dos arquivos

```text
webrtc-telemedicine/
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js
│       ├── media.js
│       ├── signaling.js
│       ├── webrtc.js
│       ├── ui.js
│       ├── consultation.js
│       └── config.js
├── backend/
│   ├── server.js
│   ├── rooms.js
│   ├── config.js
│   ├── tls.js
│   ├── package.json
│   └── certificates/.gitignore
├── config/iceServers.js
├── .gitignore
└── README.md
```

A estrutura acima corresponde à organização planejada; confira se todos os arquivos estão presentes no repositório antes de publicá-lo.

## Responsabilidades dos módulos

| Arquivo | Responsabilidade |
| --- | --- |
| `frontend/js/app.js` | Coordenação da aplicação |
| `frontend/js/media.js` | Captura e controle dos dispositivos de mídia |
| `frontend/js/signaling.js` | Comunicação com o servidor WebSocket |
| `frontend/js/webrtc.js` | Negociação e conexão WebRTC |
| `frontend/js/ui.js` | Atualização da interface |
| `frontend/js/consultation.js` | Ciclo de vida e controles da consulta |
| `frontend/js/config.js` | Configuração do endereço de sinalização |
| `backend/server.js` | Servidor HTTP/HTTPS e sinalização WS/WSS |
| `backend/rooms.js` | Participantes e salas |
| `backend/config.js` | Configuração de host, porta e limites |
| `backend/tls.js` | Carregamento opcional de certificados TLS |

## Requisitos

- Node.js e npm instalados.
- Python disponível para servir os arquivos estáticos **ou** um servidor local equivalente (por exemplo, Live Server).
- Navegador moderno com suporte a WebRTC.
- Câmera e microfone disponíveis, com permissões concedidas ao navegador.

## Instalação

No terminal, a partir da raiz do repositório:

```powershell
cd backend
npm install
cd ..
```

O comando instala as dependências declaradas em `backend/package.json`.

## Execução local (HTTP + WS)

**Terminal 1 — Backend:**

```powershell
$env:TELEMED_TLS_ENABLED = "false"
node backend/server.js
```

Configuração local padrão esperada:

- Health check: `http://127.0.0.1:3000/`
- Sinalização: `ws://127.0.0.1:3000/signaling`

**Terminal 2 — Frontend:**

```powershell
cd frontend
python -m http.server 5500 --bind 127.0.0.1
```

Abra `http://127.0.0.1:5500/`. Se o comando `python` não estiver disponível, use o comando equivalente da sua instalação ou um servidor estático local.

> O endereço do frontend e o endereço configurado em `frontend/js/config.js` devem apontar para o mesmo backend. Não abra `index.html` diretamente por `file://`.

## Demonstração da consulta

1. Inicie backend e frontend.
2. Abra a aplicação em duas janelas ou dois navegadores.
3. Conceda as permissões de câmera e microfone.
4. Entre com os dois participantes na mesma sala (exemplo: `consulta-teste-001`).
5. Aguarde a negociação WebRTC e confirme a recepção de áudio e vídeo nos dois sentidos.
6. Teste os botões de microfone e câmera e o temporizador.
7. Encerre a consulta e verifique se os dispositivos foram liberados.
8. Inicie outra consulta para confirmar a possibilidade de reconexão.

## Fluxo técnico resumido

```text
Participante A             Servidor de sinalização             Participante B
    |                                |                                |
    |----------- join -------------->|<------------- join -----------|
    |<---------- joined -------------|------------- joined --------->|
    |<-------- peer-joined ----------|                                |
    |----------- offer ------------->|------------- offer ---------->|
    |<---------- answer -------------|<------------ answer ----------|
    |<------ ice-candidate --------->|<-------- ice-candidate ------->|
    |                                |                                |
    |<============= áudio e vídeo via WebRTC ========================>|
```

O caminho efetivo de mídia depende da conectividade e da seleção de candidatos ICE; não se deve presumir comunicação direta em todas as redes.

## Resultados das validações locais

Os testes abaixo foram **relatados como aprovados durante o desenvolvimento**, não representam uma auditoria independente ou testes automatizados:

| Etapa | Verificações confirmadas | Resultado |
| --- | ---: | --- |
| 9.1 — Integração frontend/backend | 5/5 | Aprovada |
| 9.2 — Entrada e sinalização entre participantes | 6/6 | Aprovada |
| 9.3 — Áudio e vídeo bidirecionais | 8/8 | Aprovada |
| 9.4 — Controles da consulta | 7/7 | Aprovada |
| 9.5 — Encerramento, limpeza e reconexão | 8/8 | Aprovada |

**Total: 34 verificações confirmadas no ambiente local testado.**

## Limitações

- Protótipo educacional, sem validação para atendimento médico real.
- Não inclui autenticação robusta, controle de acesso clínico, persistência de prontuários ou garantias de conformidade regulatória.
- Os testes relatados ocorreram em ambiente local; funcionamento entre redes diferentes não foi validado.
- STUN/TURN e HTTPS/WSS podem ser necessários conforme o ambiente de implantação.
- O navegador pode exigir HTTPS para acesso à câmera e ao microfone fora de `localhost`.
- Não inserir dados pessoais, prontuários ou outras informações sensíveis de pacientes.

## Segurança e repositório

Mantenha chaves privadas e certificados locais fora do controle de versão. Preserve `backend/certificates/.gitignore` e revise o `.gitignore` principal. O uso de `ws://` e HTTP é destinado apenas a testes locais de desenvolvimento.

## Status

**Versão:** 1.0 (protótipo experimental, sujeito à revisão final do repositório).

**Validação:** fluxo principal aprovado no ambiente local, conforme testes relatados.

**Pendência:** revisar se os arquivos reais, scripts e dependências do repositório correspondem a esta documentação antes de considerar a entrega finalizada.
