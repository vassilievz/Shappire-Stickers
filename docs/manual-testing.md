# Testes manuais em dispositivo Android

Este roteiro cobre o que **não** pode ser validado por testes automatizados (WebView,
câmera, sistema de arquivos e a integração com o WhatsApp). Os testes automatizados atuais
(121, em `npm test`) cobrem o domínio, a validação do WhatsApp, a exportação, a
persistência, os pacotes e o histórico.

Pré-requisitos:

- dispositivo Android com **Android 7.0+** (minSdk 24);
- WhatsApp **e/ou** WhatsApp Business instalado, com uma conta ativa;
- APK de debug instalado (`npm run android:debug` ou Android Studio).

## 1. Instalação e primeiro uso

- [ ] O app abre direto na tela **Início**, sem tela branca nem erro de console.
- [ ] O tema escuro é aplicado e o quadriculado de transparência aparece.
- [ ] Os estados vazios ("Nenhum projeto ainda", "Nenhum pacote criado") são exibidos.
- [ ] A barra inferior (Início / Pacotes / Ajustes) navega corretamente.

## 2. Importação de imagens

- [ ] "Criar figurinha" → importar imagem: o seletor nativo do Android abre sem pedir
      permissão de armazenamento (Photo Picker).
- [ ] Importa PNG com transparência, JPEG e WebP corretamente.
- [ ] Uma foto grande (ex.: 4000 × 3000) é reduzida (aviso "A imagem foi reduzida…") e não
      trava o app.
- [ ] Cancelar o seletor não gera erro (nenhum aviso de falha).
- [ ] Selecionar um arquivo inválido (ex.: PDF renomeado para PNG) mostra a mensagem de
      formato não suportado em português.

## 3. Editor

- [ ] Arrastar, redimensionar (alças) e girar (alça superior) funcionam com um dedo.
- [ ] Pinça com dois dedos amplia/reduz sem mover o elemento selecionado.
- [ ] Os botões de zoom (+/−) e o percentual respondem.
- [ ] Texto: adicionar, editar conteúdo, trocar fonte/tamanho/cor/alinhamento, contorno e
      sombra refletem no canvas imediatamente.
- [ ] Texto com acentuação e emoji é renderizado corretamente.
- [ ] Desenho livre funciona; a borracha de desenho apaga **somente** o desenho, sem afetar
      a imagem abaixo.
- [ ] "Limpar desenhos" e "Último traço" funcionam.
- [ ] Recorte: passe o dedo sobre a imagem para apagar bordas (fundo) preservando áreas
      internas; "Restaurar" devolve o que foi apagado.
- [ ] O contorno (cor + espessura) acompanha a silhueta, inclusive nas áreas recortadas.
- [ ] Camadas: reordenar, ocultar e travar produzem efeito visível.
- [ ] Duplicar e excluir funcionam com o elemento selecionado.

## 4. Histórico

- [ ] Cada ação (adicionar, mover, redimensionar, girar, mudar cor, desenhar, recortar)
      pode ser desfeita e refeita.
- [ ] Uma sessão de edição de texto gera **uma** operação de desfazer.
- [ ] Desfazer após remover um elemento restaura-o.
- [ ] Após 40 operações, as mais antigas são descartadas sem travar o app.

## 5. Persistência

- [ ] Salvar → fechar o app (remover dos recentes) → reabrir: o projeto está na tela
      inicial com miniatura e continua editável.
- [ ] Enviar o app para segundo plano (botão Início) e voltar: o trabalho não é perdido e o
      salvamento automático ocorreu.
- [ ] Girar o dispositivo não reinicia o editor nem perde o estado.
- [ ] Recuperar projeto salvo recarrega as imagens importadas corretamente.

## 6. Pacotes

- [ ] Criar pacote com nome e autor; validar mensagens para nome/autor vazios ou com
      caracteres inválidos (`!`, `?`, `..`).
- [ ] Criar pacote no editor e escolher o destino na folha de exportação.
- [ ] Importar imagem pronta direto no pacote.
- [ ] Reordenar figurinhas (mover para a esquerda/direita) reflete na grade.
- [ ] Definir ícone do pacote a partir de uma figurinha.
- [ ] Editar emojis (1–3) e texto de acessibilidade; valores inválidos são recusados.
- [ ] Excluir pacote pede confirmação e some da lista; recriar com o mesmo nome funciona.
- [ ] Limite de 10 pacotes: a criação do 11º é bloqueada com mensagem clara.

## 7. Exportação

- [ ] Exportar uma figurinha simples gera arquivo ≤ 100 KB (o tamanho aparece no aviso).
- [ ] Exportar uma foto complexa reduz a qualidade automaticamente e ainda gera ≤ 100 KB.
- [ ] Uma imagem impossível de comprimir (ex.: ruído aleatório) mostra a mensagem de
      limite excedido — e **não** adiciona lixo ao pacote.
- [ ] A figurinha exportada tem 512 × 512 e fundo transparente (confira no WhatsApp ou com
      um visualizador de WebP).
- [ ] "Compartilhar figurinha" abre a folha de compartilhamento do Android com a imagem.
- [ ] Pacote com menos de 3 figurinhas: o botão "Adicionar" ao WhatsApp fica desabilitado e
      explica o motivo.

## 8. Integração com o WhatsApp

- [ ] "Verificar" no detalhe do pacote roda a validação nativa e informa sucesso ou lista as
      pendências reais (arquivos ausentes, dimensões, tamanho, emojis).
- [ ] Renomear arquivo/tamanho de uma figurinha no armazenamento do app e verificar:
      a validação nativa acusa o problema.
- [ ] "Adicionar" abre o diálogo oficial do WhatsApp com o nome do pacote e o autor.
- [ ] Confirmar no WhatsApp: o pacote aparece na bandeja de figurinhas.
- [ ] Voltar ao app: a mensagem "Pacote já adicionado ao WhatsApp" aparece.
- [ ] Cancelar no WhatsApp: o app informa que a adição foi cancelada (sem mensagem de erro).
- [ ] Desinstalar o WhatsApp (ou testar em dispositivo sem ele): o app mostra o aviso e o
      botão "Instalar WhatsApp" abre a Play Store.
- [ ] Testar também com **WhatsApp Business** instalado.
- [ ] Após adicionar e editar o pacote (adicionar figurinha), a versão de conteúdo muda e o
      WhatsApp atualiza o conjunto (a figurinha nova aparece).

## 9. Robustez

- [ ] Preencher um pacote com 30 figurinhas e exportar: a 31ª é bloqueada.
- [ ] Excluir um projeto em uso e reabrir o app: nenhum erro, lista consistente.
- [ ] Navegar rapidamente entre telas com o editor aberto não gera tela branca.
- [ ] Verificar o console (`chrome://inspect`) durante os fluxos acima: sem erros não
      tratados.

> Registre o modelo do dispositivo, a versão do Android e a versão do WhatsApp ao abrir
> qualquer problema. O APK de debug já compila via `gradlew assembleDebug`; o que falta
> para considerar a integração nativa "concluída" é exatamente esta validação em
> dispositivo real.
