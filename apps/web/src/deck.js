import './styles.css';
import { DECK, mountAll } from './cards.js';
import { applyStatic, t } from './i18n';

applyStatic();

const grid = document.getElementById('grid');
grid.innerHTML = DECK.map((c, i) =>
  `<a href="#" class="playing-card" style="--tilt:${i % 2 ? 1.5 : -1.5}deg" data-card="${c.key}" aria-label="${t('card.aria', { name: c.name })}"></a>`).join('');
mountAll();
