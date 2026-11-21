/* Apoiantes do Mamly.
 * Para acrescentar um apoiante: põe o logo em web/supporters/ (SVG ou PNG com fundo transparente,
 * formato largo, ~4:1) e preenche abaixo. "logoDark" é opcional (versão para o modo escuro).
 *
 *   main:   apoiante principal → fim da lista no ecrã principal, ecrã «nada pendente» e mural
 *   others: restantes apoiantes → mural nas definições
 *
 * Exemplo:
 *   main: { name: 'Marca', logo: 'supporters/marca.svg', logoDark: 'supporters/marca-branco.svg', url: 'https://marca.pt' },
 *   others: [ { name: 'Outra', logo: 'supporters/outra.png', url: 'https://outra.pt' } ],
 */
window.MAMLY_SUPPORTERS = {
  main: null,
  others: [],
};
