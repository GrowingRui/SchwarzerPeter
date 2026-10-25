import './styles.css';
import { DECK, mountAll } from './cards.js';

const grid = document.getElementById('grid');
grid.innerHTML = DECK.map((c, i) =>
  `<a href="#" class="playing-card" style="--tilt:${i % 2 ? 1.5 : -1.5}deg" data-card="${c.key}" aria-label="${c.name} card"></a>`).join('');
mountAll();
