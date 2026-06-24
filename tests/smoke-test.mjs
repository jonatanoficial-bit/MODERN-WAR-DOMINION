import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const countries = JSON.parse(fs.readFileSync(path.join(root, 'data/countries.json'), 'utf8'));

const checks = [
  ['Tela inicial presente', html.includes('screenHome')],
  ['Tela seleção de nação presente', html.includes('screenNation')],
  ['Tela de jogo presente', html.includes('screenGame')],
  ['Botão nova campanha presente', html.includes('newGameBtn')],
  ['Botão continuar presente', html.includes('continueBtn')],
  ['Painel do mapa presente', html.includes('ukraine-map-wrap')],
  ['Ações estratégicas presentes', html.includes('data-action="economy"') && html.includes('data-action="military"')],
  ['Próximo turno implementado', js.includes('function nextTurn')],
  ['Seleção de país implementada', js.includes('function selectCountry')],
  ['Eventos mensais implementados', js.includes('eventPool')],
  ['15 países carregados', countries.length >= 15],
  ['Todos os países possuem stats principais', countries.every((country) => ['economy', 'military', 'diplomacy', 'intel', 'logistics', 'stability', 'tech'].every((key) => typeof country.stats?.[key] === 'number'))]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('SMOKE FAIL');
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}

console.log('SMOKE OK — fluxo principal, mapa, nações, ações e turnos encontrados.');
