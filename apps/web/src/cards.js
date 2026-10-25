/* Schwarzer Peter: Alpine deck card art.
   Every card is an inline SVG so it scales cleanly and uses the page fonts.
   Usage: <div data-card="steinbock"></div>, then mountAll(). */
import { t } from './i18n';

const N = '#1E2430';   // Kohle
const N2 = '#3A4354';  // far limbs, shading
const E = '#E8622C';   // Glut
const ED = '#C24E1E';  // Glut deep
const B = '#C6A15B';   // Messing
const C = '#F4E4C1';   // Pergament
const R = '#12151B';   // Russ

const leg = (d, w = 7, c = N) => `<path d="${d}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;

function spikes(cx, cy, rx, ry, n) {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = Math.PI - (Math.PI * i) / n;
    const k = i % 2 ? 1 : 0.8;
    d += (i ? 'L' : 'M') + (cx + rx * k * Math.cos(t)).toFixed(1) + ' ' + (cy - ry * k * Math.sin(t)).toFixed(1);
  }
  return d + 'Z';
}

/* Each art function draws inside a 200 x 160 box, ground line near y = 148. */
const ART = {
  steinbock: () => `
    ${leg('M80 112 L78 148', 7, N2)}${leg('M124 112 L128 148', 7, N2)}
    <path d="M62 104 C62 88 80 82 100 84 C116 85 128 84 136 88 C142 92 142 108 134 116 C124 122 80 124 70 118 C64 115 62 110 62 104 Z" fill="${N}"/>
    ${leg('M72 114 L70 148', 8)}${leg('M130 112 L134 148', 8)}
    ${leg('M63 98 L56 93', 5)}
    <path d="M124 94 C128 80 136 68 144 60 L156 66 C150 76 146 88 142 102 Z" fill="${N}"/>
    <path d="M142 56 C150 51 160 55 166 63 L172 71 C173 76 168 78 164 76 L152 72 C145 70 140 64 142 56 Z" fill="${N}"/>
    <path d="M156 74 L154 86 L161 76 Z" fill="${N}"/>
    <path d="M144 58 C134 28 112 14 94 24 C112 21 132 32 151 56 Z" fill="${N}"/>
    <path d="M146 54 C137 32 118 21 102 24" stroke="${C}" stroke-width="5" stroke-dasharray="1.4 5" opacity=".55" fill="none"/>
    <ellipse cx="141" cy="62" rx="6" ry="3" transform="rotate(-30 141 62)" fill="${N2}"/>
    <circle cx="153" cy="63" r="1.7" fill="${C}"/>`,

  murmeltier: () => `
    <ellipse cx="100" cy="116" rx="27" ry="34" fill="${N}"/>
    <ellipse cx="100" cy="121" rx="16" ry="24" fill="${B}"/>
    <ellipse cx="93" cy="99" rx="5.5" ry="4" transform="rotate(-25 93 99)" fill="${N}"/>
    <ellipse cx="107" cy="99" rx="5.5" ry="4" transform="rotate(25 107 99)" fill="${N}"/>
    <ellipse cx="81" cy="63" rx="4" ry="3.4" fill="${N}"/><ellipse cx="119" cy="63" rx="4" ry="3.4" fill="${N}"/>
    <ellipse cx="100" cy="73" rx="21" ry="17" fill="${N}"/>
    <ellipse cx="100" cy="80" rx="9.5" ry="7.5" fill="${B}"/>
    <ellipse cx="100" cy="76" rx="3.2" ry="2.2" fill="${N}"/>
    <path d="M90 79 L76 76 M90 81 L76 82 M110 79 L124 76 M110 81 L124 82" stroke="${C}" stroke-width=".7" opacity=".7"/>
    <rect x="97.6" y="84" width="4.8" height="5" rx="1" fill="${C}"/>
    <circle cx="92" cy="67" r="2.6" fill="${C}"/><circle cx="108" cy="67" r="2.6" fill="${C}"/>
    <circle cx="92.4" cy="67.4" r="1.3" fill="${N}"/><circle cx="108.4" cy="67.4" r="1.3" fill="${N}"/>
    <ellipse cx="86" cy="148" rx="11" ry="4" fill="${N}"/><ellipse cx="114" cy="148" rx="11" ry="4" fill="${N}"/>`,

  gaemse: () => `<g transform="translate(200 0) scale(-1 1)">
    ${leg('M82 112 L80 148', 6, N2)}${leg('M124 110 L127 148', 6, N2)}
    <path d="M66 102 C66 90 82 86 100 87 C116 88 128 86 135 90 C140 94 140 106 133 112 C124 117 82 119 72 114 C67 111 66 107 66 102 Z" fill="${N}"/>
    ${leg('M74 112 L72 148', 6.5)}${leg('M130 110 L133 148', 6.5)}
    ${leg('M67 97 L61 94', 4)}
    <path d="M124 96 C128 82 136 70 144 62 L155 68 C149 78 145 90 141 104 Z" fill="${N}"/>
    <path d="M142 58 C150 53 159 57 165 65 L171 73 C172 78 167 80 163 78 L151 74 C144 72 139 66 142 58 Z" fill="${N}"/>
    <path d="M147 58 L163 75" stroke="${C}" stroke-width="3" stroke-linecap="round"/>
    <path d="M148 57 C146 46 148 38 154 36 C159 35 160 41 156 44" stroke="${N}" stroke-width="3.6" stroke-linecap="round" fill="none"/>
    <path d="M152 59 C151 48 154 41 160 39 C164 39 164 45 160 47" stroke="${N}" stroke-width="3.2" stroke-linecap="round" fill="none"/>
    <ellipse cx="143" cy="62" rx="6" ry="2.6" transform="rotate(-35 143 62)" fill="${N2}"/>
    <circle cx="154" cy="64" r="1.6" fill="${N}"/></g>`,

  bartgeier: () => `
    <path d="M96 78 C80 64 52 56 16 62 L28 69 L12 75 L32 79 L18 86 L40 86 L28 94 L56 90 C72 90 86 88 96 87 Z" fill="${N}"/>
    <path d="M104 78 C120 64 148 56 184 62 L172 69 L188 75 L168 79 L182 86 L160 86 L172 94 L144 90 C128 90 114 88 104 87 Z" fill="${N}"/>
    <path d="M93 98 L100 130 L107 98 Z" fill="${N}"/>
    <ellipse cx="100" cy="86" rx="10" ry="19" fill="${E}"/>
    <circle cx="100" cy="64" r="8.5" fill="${E}"/>
    <path d="M97 70 L100 80 L103 70 Z" fill="${N}"/>
    <circle cx="96.5" cy="62.5" r="2.2" fill="${C}"/><circle cx="103.5" cy="62.5" r="2.2" fill="${C}"/>
    <circle cx="96.5" cy="62.5" r="1" fill="${N}"/><circle cx="103.5" cy="62.5" r="1" fill="${N}"/>
    <path d="M62 82 L88 82 M138 82 L112 82" stroke="${B}" stroke-width="1.2" opacity=".6"/>`,

  fuchs: () => `
    <path d="M86 146 C58 148 44 132 50 116 C56 104 72 108 72 122 C72 134 80 140 96 140 Z" fill="${E}"/>
    <path d="M58 112 C50 116 46 128 50 138 C52 128 56 120 64 116 Z" fill="${C}"/>
    <path d="M80 148 C76 120 84 96 100 88 C112 84 122 92 122 104 C124 120 124 136 120 148 Z" fill="${E}"/>
    <path d="M108 96 C118 100 120 116 116 132 C112 124 106 112 104 100 Z" fill="${C}"/>
    ${leg('M112 128 L112 148', 6)}${leg('M118 128 L119 148', 6)}
    <path d="M98 92 C96 80 102 70 112 68 C120 68 126 74 140 78 C136 84 128 87 120 89 C114 92 104 96 98 92 Z" fill="${E}"/>
    <path d="M120 89 C128 87 135 84 140 78 C134 87 126 91 117 91 Z" fill="${C}"/>
    <path d="M102 75 L99 54 L112 69 Z" fill="${E}"/><path d="M101 66 L99 54 L106 62 Z" fill="${N}"/>
    <path d="M109 70 L112 52 L118 69 Z" fill="${ED}"/>
    <circle cx="140" cy="78" r="2.3" fill="${N}"/>
    <path d="M113 76 Q117 73 121 76 Q117 78 113 76 Z" fill="${N}"/>`,

  hirsch: () => `
    ${leg('M82 112 L80 148', 6.5, N2)}${leg('M126 110 L130 148', 6.5, N2)}
    <path d="M62 102 C62 88 80 84 100 85 C118 86 130 84 137 88 C143 92 143 106 135 113 C125 119 80 121 70 115 C64 112 62 108 62 102 Z" fill="${N}"/>
    ${leg('M73 112 L70 148', 7)}${leg('M132 110 L136 148', 7)}
    <path d="M64 96 L58 100 L62 104 Z" fill="${C}"/>
    <path d="M124 94 C126 80 132 68 140 58 L152 64 C147 76 144 88 142 102 Z" fill="${N}"/>
    <path d="M128 84 L132 98 L138 84 L142 98" stroke="${N2}" stroke-width="2" fill="none"/>
    <path d="M140 54 C148 50 158 54 164 62 L172 72 C173 77 168 79 164 77 L151 72 C143 69 137 62 140 54 Z" fill="${N}"/>
    <ellipse cx="137" cy="56" rx="8" ry="3.2" transform="rotate(-25 137 56)" fill="${N}"/>
    <g stroke="${N2}" stroke-width="2.6" stroke-linecap="round" fill="none">
      <path d="M144 52 C140 36 130 24 118 16"/><path d="M137 38 L126 34"/><path d="M130 28 L132 14"/><path d="M122 20 L114 10"/></g>
    <g stroke="${N}" stroke-width="3" stroke-linecap="round" fill="none">
      <path d="M148 52 C150 36 160 22 172 14"/><path d="M151 40 L162 38"/><path d="M157 30 L154 16"/><path d="M165 20 L174 10"/><path d="M168 18 L180 18"/></g>
    <circle cx="152" cy="60" r="1.7" fill="${C}"/>`,

  adler: () => `
    <path d="M66 150 L78 128 L100 122 L124 126 L140 150 Z" fill="${N2}"/>
    <path d="M78 128 L100 122 L110 124" stroke="${C}" stroke-width="1.2" opacity=".35" fill="none"/>
    <path d="M95 126 L90 146 L104 146 L107 126 Z" fill="${N}"/>
    <path d="M88 126 C80 104 84 78 100 70 C110 66 118 70 120 80 C124 100 120 118 112 128 Z" fill="${N}"/>
    <path d="M92 82 C83 102 86 122 98 138 L106 128 C100 112 100 96 106 84 Z" fill="#2B3240"/>
    <path d="M95 96 L101 100 M93 106 L100 110 M94 116 L101 120" stroke="${B}" stroke-width="1.2" opacity=".55"/>
    <path d="M103 74 C103 60 113 53 124 57 C130 59 133 65 131 70 L120 76 C112 80 105 80 103 74 Z" fill="${B}"/>
    <path d="M127 61 C136 60 141 66 137 74 C135 70 131 70 127 70 Z" fill="${N}"/>
    <path d="M127 61 L131 61 L131 68 L127 69 Z" fill="${E}"/>
    <circle cx="122" cy="63" r="1.9" fill="${N}"/>
    <path d="M98 126 L96 131 M103 126 L103 131 M108 126 L110 131" stroke="${E}" stroke-width="1.8" stroke-linecap="round"/>`,

  igel: () => `
    <path d="${spikes(94, 132, 46, 36, 34)}" fill="${N}"/>
    <ellipse cx="94" cy="134" rx="44" ry="14" fill="${N2}"/>
    <path d="M126 122 C136 117 147 124 158 134 C151 141 140 143 129 140 Z" fill="${B}"/>
    <circle cx="158" cy="134" r="2.8" fill="${N}"/>
    <circle cx="140" cy="128" r="1.8" fill="${N}"/>
    <ellipse cx="130" cy="122" rx="3.5" ry="2.5" fill="${N2}"/>
    <ellipse cx="108" cy="148" rx="6" ry="3" fill="${N}"/><ellipse cx="128" cy="147" rx="6" ry="3" fill="${N}"/>
    <ellipse cx="66" cy="148" rx="6" ry="3" fill="${N}"/>`,

  eule: () => `
    ${leg('M28 142 C80 136 130 144 178 132', 7, N2)}
    <path d="M76 66 L69 42 L90 60 Z" fill="${N}"/><path d="M124 66 L131 42 L110 60 Z" fill="${N}"/>
    <path d="M100 56 C124 56 132 76 132 100 C132 124 118 140 100 140 C82 140 68 124 68 100 C68 76 76 56 100 56 Z" fill="${N}"/>
    <circle cx="88" cy="80" r="12.5" fill="${N2}"/><circle cx="112" cy="80" r="12.5" fill="${N2}"/>
    <circle cx="88" cy="80" r="8" fill="${E}"/><circle cx="112" cy="80" r="8" fill="${E}"/>
    <circle cx="88" cy="80" r="3.8" fill="${N}"/><circle cx="112" cy="80" r="3.8" fill="${N}"/>
    <circle cx="90" cy="78" r="1.3" fill="${C}"/><circle cx="114" cy="78" r="1.3" fill="${C}"/>
    <path d="M100 86 L96 92 L100 99 L104 92 Z" fill="${B}"/>
    <g stroke="${B}" stroke-width="1.6" fill="none" opacity=".7" stroke-linecap="round">
      <path d="M86 108 L90 112 L94 108"/><path d="M98 112 L102 116 L106 112"/><path d="M108 106 L112 110 L116 106"/>
      <path d="M88 122 L92 126 L96 122"/><path d="M104 122 L108 126 L112 122"/></g>
    <path d="M90 138 L88 143 M94 138 L94 144 M106 138 L106 144 M110 138 L112 143" stroke="${B}" stroke-width="2" stroke-linecap="round"/>`,

  kuh: () => `
    ${leg('M62 120 L62 148', 8, N2)}${leg('M132 120 L134 148', 8, N2)}
    <path d="M44 92 C44 82 54 78 70 78 L124 78 C136 78 142 84 142 96 L142 112 C142 120 136 124 126 124 L60 124 C50 124 44 118 44 108 Z" fill="${N}"/>
    <path d="M68 84 C80 81 91 88 89 98 C87 109 72 109 66 101 C61 94 63 86 68 84 Z" fill="${C}"/>
    <path d="M110 90 C119 86 129 93 125 104 C121 111 110 109 108 100 Z" fill="${C}"/>
    ${leg('M52 120 L51 148', 8.5)}${leg('M124 120 L125 148', 8.5)}
    <path d="M45 90 C37 100 37 114 39 124" stroke="${N}" stroke-width="3" fill="none"/>
    <ellipse cx="39" cy="127" rx="3" ry="5" fill="${N}"/>
    <path d="M138 82 C146 77 158 79 164 88 L168 103 C168 110 160 112 154 108 L140 96 Z" fill="${N}"/>
    <ellipse cx="163" cy="106" rx="7" ry="5" fill="${C}"/>
    <path d="M147 80 C143 72 147 66 154 67" stroke="${C}" stroke-width="3.4" stroke-linecap="round" fill="none"/>
    <path d="M154 80 C153 72 158 68 164 70" stroke="${B}" stroke-width="3" stroke-linecap="round" fill="none"/>
    <ellipse cx="139" cy="86" rx="7" ry="3.2" transform="rotate(15 139 86)" fill="${N}"/>
    <circle cx="153" cy="89" r="1.8" fill="${C}"/>
    <path d="M144 98 C148 108 152 112 157 114" stroke="${E}" stroke-width="4" fill="none"/>
    <path d="M151 114 L164 114 L167 129 L148 129 Z" fill="${B}"/>
    <path d="M150 119 L165 119" stroke="${N}" stroke-width="1" opacity=".4"/>
    <circle cx="157.5" cy="131" r="2.4" fill="${B}"/>`,

  bernhardiner: () => `
    <path d="M78 146 C64 146 58 136 62 126 C68 132 76 134 86 136 Z" fill="${N}"/>
    <path d="M74 148 C70 118 78 94 96 86 C112 80 126 90 128 106 C130 122 130 136 126 148 Z" fill="${N}"/>
    <path d="M112 92 C124 98 126 116 120 136 C114 124 110 108 108 96 Z" fill="${C}"/>
    ${leg('M116 128 L116 148', 7, C)}${leg('M124 128 L124 148', 7, C)}
    <path d="M100 86 C98 69 108 58 122 58 C132 58 138 64 142 70 L150 73 C155 77 154 88 146 91 L112 93 Z" fill="${N}"/>
    <path d="M134 72 L150 73 C155 77 154 88 146 91 L132 91 C127 85 128 77 134 72 Z" fill="${C}"/>
    <path d="M133 84 C138 87 144 87 150 84" stroke="${N}" stroke-width="1.2" opacity=".6" fill="none"/>
    <ellipse cx="151" cy="75.5" rx="3.4" ry="2.6" fill="${N}"/>
    <path d="M106 64 C99 66 97 79 103 86 C108 81 111 72 111 66 Z" fill="${N2}"/>
    <circle cx="128" cy="68" r="2.2" fill="${C}"/><circle cx="128.6" cy="68.4" r="1.1" fill="${N}"/>
    <path d="M104 90 C110 96 118 98 125 96" stroke="${E}" stroke-width="3" fill="none"/>
    <rect x="107" y="98" width="17" height="11" rx="3" fill="${B}"/>
    <path d="M111 98 V109 M120 98 V109" stroke="${ED}" stroke-width="1.6"/>`,

  wolf: () => `
    <path d="M80 146 C62 147 55 134 61 124 C68 131 76 135 88 137 Z" fill="${N}"/>
    <path d="M80 148 C76 120 86 98 102 90 C112 86 120 92 122 104 C124 120 124 136 120 148 Z" fill="${N}"/>
    <path d="M110 94 C118 100 120 116 116 134 C112 122 108 106 106 96 Z" fill="${N2}"/>
    ${leg('M112 128 L112 148', 6)}${leg('M118 128 L119 148', 6)}
    <path d="M104 94 C106 76 112 64 121 55 L141 34 C145 31 149 35 146 40 L136 55 C131 64 126 76 122 94 Z" fill="${N}"/>
    <path d="M120 58 L114 41 L127 51 Z" fill="${N}"/>
    <path d="M126 50 Q130 47 133 49" stroke="${C}" stroke-width="1.4" fill="none"/>
    <path d="M141 40 L150 34" stroke="${N}" stroke-width="2" stroke-linecap="round"/>`,

  baer: () => `
    ${leg('M64 122 L63 147', 13, N2)}${leg('M122 120 L124 147', 12, N2)}
    <path d="M42 112 C42 92 58 78 82 76 C96 68 112 70 124 78 C134 84 140 90 144 100 L144 116 C140 124 132 128 124 128 L60 128 C50 128 42 122 42 112 Z" fill="${N}"/>
    ${leg('M76 122 L74 147', 14)}${leg('M134 120 L138 147', 13)}
    <path d="M138 92 C146 86 157 90 161 100 L170 108 C172 113 168 117 163 117 L150 117 C141 114 134 104 138 92 Z" fill="${N}"/>
    <circle cx="146" cy="90" r="5.5" fill="${N}"/><circle cx="146" cy="90" r="2.4" fill="${N2}"/>
    <circle cx="155" cy="101" r="1.7" fill="${C}"/>
    <path d="M90 82 C100 78 112 80 120 86" stroke="${N2}" stroke-width="1.5" fill="none"/>`,

  schneehase: () => `
    <g stroke="${N}" stroke-width="2.2" stroke-linejoin="round">
      <path d="M128 92 C132 72 140 58 148 52 C151 60 144 78 134 96 Z" fill="#E7D6B2"/>
      <ellipse cx="96" cy="128" rx="32" ry="22" fill="${C}"/>
      <circle cx="66" cy="126" r="6" fill="${C}"/>
      <ellipse cx="124" cy="146" rx="10" ry="3.5" fill="${C}"/>
      <ellipse cx="124" cy="102" rx="15" ry="12" transform="rotate(-20 124 102)" fill="${C}"/>
      <path d="M118 94 C111 72 111 55 118 46 C125 54 126 74 125 92 Z" fill="${C}"/>
    </g>
    <path d="M115 52 C116 49 117 47 118 46 C120 49 121 52 122 55 Z" fill="${N}"/>
    <path d="M145 56 C146 54 147 53 148 52 C148 55 147 58 146 60 Z" fill="${N}"/>
    <circle cx="129" cy="98" r="2.2" fill="${N}"/>
    <circle cx="138" cy="106" r="1.6" fill="${E}"/>`,

  eichhoernchen: () => `
    <path d="M90 142 C60 140 48 112 56 88 C62 68 82 60 93 71 C101 80 93 92 85 96 C76 104 80 124 98 132 Z" fill="${E}"/>
    <path d="M66 86 C72 74 84 72 88 78 M62 100 C60 112 66 126 78 134" stroke="${ED}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M92 146 C88 126 96 106 110 100 C122 98 128 108 128 122 C128 134 124 144 118 148 Z" fill="${E}"/>
    <path d="M116 108 C124 112 126 128 120 140 C116 132 112 120 112 110 Z" fill="${C}"/>
    <circle cx="122" cy="90" r="12.5" fill="${E}"/>
    <path d="M129 86 C136 88 139 93 135 97 L126 97 Z" fill="${E}"/>
    <path d="M116 81 L113 64 L123 78 Z" fill="${E}"/><path d="M115 72 L113 64 L118 70 Z" fill="${N}"/>
    <circle cx="126" cy="86" r="2.1" fill="${N}"/>
    <circle cx="137" cy="94" r="1.3" fill="${N}"/>
    <ellipse cx="134" cy="109" rx="5.5" ry="6.5" fill="${B}"/>
    <path d="M131 103 C133 100 136 100 138 103" stroke="${N}" stroke-width="1.6" fill="none"/>
    <ellipse cx="129" cy="110" rx="3.5" ry="2.6" fill="${ED}"/>
    <ellipse cx="110" cy="148" rx="11" ry="3.4" fill="${ED}"/>`,

  dachs: () => `
    ${leg('M66 130 L64 147', 10, N)}${leg('M126 130 L129 147', 10, N)}
    <path d="M40 120 C40 104 60 96 90 96 C116 96 136 100 146 108 L150 124 C150 132 140 136 128 136 L60 136 C48 136 40 130 40 120 Z" fill="${N2}"/>
    <path d="M48 110 C70 100 110 98 140 106" stroke="${C}" stroke-width="1.3" opacity=".35" fill="none"/>
    ${leg('M78 130 L77 147', 11)}${leg('M136 128 L140 147', 11)}
    <path d="M140 104 C150 100 160 104 168 114 L176 122 C176 126 172 128 168 128 L148 126 C140 120 136 110 140 104 Z" fill="${C}"/>
    <path d="M144 105 C155 106 165 113 172 121 L168 124 C160 117 151 113 142 111 Z" fill="${N}"/>
    <path d="M141 115 C150 117 158 121 166 126 L158 127 C152 124 146 122 141 121 Z" fill="${N}"/>
    <ellipse cx="141" cy="104" rx="4" ry="3" fill="${C}"/>
    <circle cx="175" cy="123" r="2.6" fill="${N}"/>`,

  forelle: () => `
    <g transform="rotate(-18 100 88) translate(0 -6)">
      <path d="M52 90 L30 72 L37 90 L30 108 Z" fill="${N}"/>
      <path d="M50 90 C70 72 120 68 150 84 C157 88 159 92 157 94 C150 99 120 106 90 104 C72 102 60 98 50 90 Z" fill="${N}"/>
      <path d="M60 96 C90 104 130 102 153 94 C140 106 100 110 70 102 Z" fill="${B}"/>
      <path d="M64 92 C100 90 130 90 150 88" stroke="${E}" stroke-width="3.5" opacity=".8" fill="none" stroke-linecap="round"/>
      <path d="M96 74 L106 60 L116 73 Z" fill="${N}"/>
      <path d="M104 102 L108 114 L116 103 Z" fill="${N}"/>
      <g fill="${E}"><circle cx="76" cy="84" r="1.9"/><circle cx="88" cy="80" r="1.9"/><circle cx="100" cy="82" r="1.9"/><circle cx="112" cy="78" r="1.9"/><circle cx="124" cy="81" r="1.9"/><circle cx="94" cy="88" r="1.6"/><circle cx="118" cy="87" r="1.6"/></g>
      <circle cx="146" cy="85" r="2.8" fill="${C}"/><circle cx="146.6" cy="85.4" r="1.3" fill="${N}"/>
    </g>
    <g fill="${C}"><circle cx="58" cy="124" r="3"/><circle cx="48" cy="114" r="2"/><circle cx="66" cy="112" r="1.6"/><circle cx="140" cy="122" r="2.4"/></g>`,

  alpensalamander: () => `
    <ellipse cx="100" cy="132" rx="72" ry="14" fill="#8E95A3"/>
    <ellipse cx="96" cy="128" rx="60" ry="8" fill="#A4AAB6"/>
    ${leg('M82 122 L76 108 L69 106', 5)}${leg('M84 126 L80 140 L73 143', 5)}
    ${leg('M124 120 L131 106 L138 104', 5)}${leg('M122 124 L127 139 L135 141', 5)}
    <path d="M28 138 C44 134 56 124 72 122" stroke="${N}" stroke-width="5" stroke-linecap="round" fill="none"/>
    <path d="M44 133 C54 128 62 124 72 122" stroke="${N}" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M70 122 C90 116 110 128 134 120" stroke="${N}" stroke-width="15" stroke-linecap="round" fill="none"/>
    <ellipse cx="146" cy="117" rx="15" ry="10" transform="rotate(-14 146 117)" fill="${N}"/>
    <circle cx="148" cy="109" r="3.2" fill="${N}"/><circle cx="151" cy="123" r="3.2" fill="${N}"/>
    <circle cx="149" cy="108.4" r="1" fill="${C}"/><circle cx="152" cy="122.4" r="1" fill="${C}"/>
    <path d="M78 118 C92 113 108 124 128 116" stroke="${C}" stroke-width="2" stroke-dasharray="2 7" opacity=".35" stroke-linecap="round" fill="none"/>`,
};

export const DECK = [
  ['steinbock', 'Steinbock', { scale: 1.22 }], ['murmeltier', 'Murmeltier'], ['gaemse', 'Gämse'],
  ['bartgeier', 'Bartgeier', { ground: false, scale: 1.12 }], ['fuchs', 'Fuchs'], ['hirsch', 'Hirsch', { scale: 1.2 }],
  ['adler', 'Adler'], ['igel', 'Igel'], ['eule', 'Eule', { ground: false, scale: 1.25 }],
  ['kuh', 'Kuh', { scale: 1.12 }], ['bernhardiner', 'Bernhardiner'], ['wolf', 'Wolf', { moon: true }],
  ['baer', 'Bär', { scale: 1.15 }], ['schneehase', 'Schneehase'], ['eichhoernchen', 'Eichhörnchen'],
  ['dachs', 'Dachs', { scale: 1.15 }], ['forelle', 'Forelle', { water: true, scale: 1.12 }], ['alpensalamander', 'Alpensalamander', { scale: 1.12 }],
].map(([key, name, opts], i) => ({ key, name, num: i + 1, opts: opts || {} }));

let uid = 0;

function scenery(id, o) {
  const sky = o.moon
    ? `<rect width="200" height="230" fill="url(#${id}-dusk)"/><circle cx="46" cy="56" r="15" fill="${C}"/><circle cx="52" cy="52" r="13" fill="#5D6677"/>`
    : `<rect width="200" height="230" fill="url(#${id}-sky)"/>
       <g opacity=".5" stroke="${B}" stroke-width="1.2">${Array.from({ length: 12 }, (_, i) => {
         const a = (i / 12) * Math.PI * 2; return `<path d="M${(46 + Math.cos(a) * 22).toFixed(1)} ${(58 + Math.sin(a) * 22).toFixed(1)} L${(46 + Math.cos(a) * 34).toFixed(1)} ${(58 + Math.sin(a) * 34).toFixed(1)}"/>`; }).join('')}</g>
       <circle cx="46" cy="58" r="16" fill="${E}" opacity=".9"/>`;
  const ground = o.water
    ? `<path d="M-5 128 C30 122 60 132 100 126 C140 120 170 130 205 124 V170 H-5 Z" fill="#5D6677"/>
       <path d="M-5 140 C30 134 60 144 100 138 C140 132 170 142 205 136 V170 H-5 Z" fill="${N2}"/>
       <path d="M20 134 C30 131 40 135 50 132 M120 130 C132 127 142 131 152 128 M70 146 C82 143 92 147 104 144" stroke="${C}" stroke-width="1.4" opacity=".5" fill="none"/>`
    : o.ground === false ? ''
    : `<path d="M-5 140 C40 132 120 134 205 140 V170 H-5 Z" fill="#CDAE72"/>
       <path d="M18 141 l2 -5 l2 5 M58 137 l2 -5 l2 5 M150 138 l2 -5 l2 5 M182 141 l2 -5 l2 5" stroke="#9C7F45" stroke-width="1.2" fill="none"/>`;
  return `
    <defs>
      <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBF1DC"/><stop offset="1" stop-color="#EFD0A0"/></linearGradient>
      <linearGradient id="${id}-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A4354"/><stop offset="1" stop-color="#8E7A62"/></linearGradient>
    </defs>
    ${sky}
    <g transform="translate(0 65)">
      <path d="M-5 112 L22 86 L40 98 L62 70 L80 -4 L88 -2 L96 18 L112 50 L130 40 L150 62 L170 50 L205 84 V160 H-5 Z" fill="#8E95A3"/>
      <path d="M80 -4 L88 -2 L96 18 L90 14 L86 24 L80 14 L74 20 Z M130 40 L140 50 L134 50 L130 56 L126 50 L120 50 Z M170 50 L180 60 L172 58 L166 62 Z" fill="${C}"/>
      <path d="M-5 120 L30 96 L56 112 L90 86 L120 106 L150 92 L205 118 V160 H-5 Z" fill="#5D6677"/>
      ${ground}
    </g>`;
}

function frame(id, dark) {
  const bg = dark ? `url(#${id}-night)` : `url(#${id}-paper)`;
  return `
    <defs>
      <radialGradient id="${id}-paper" cx=".5" cy=".42" r=".7"><stop offset="0" stop-color="#F8ECD1"/><stop offset="1" stop-color="#E9D2A4"/></radialGradient>
      <radialGradient id="${id}-night" cx=".5" cy=".42" r=".7"><stop offset="0" stop-color="#2A3242"/><stop offset="1" stop-color="#171B24"/></radialGradient>
      <clipPath id="${id}-win"><path d="M32 262 V112 A93 64 0 0 1 218 112 V262 Z"/></clipPath>
    </defs>
    <rect x="2" y="2" width="246" height="346" rx="14" fill="${bg}"/>
    <rect x="9" y="9" width="232" height="332" rx="10" fill="none" stroke="${B}" stroke-width="1.6"/>
    <rect x="13.5" y="13.5" width="223" height="323" rx="7.5" fill="none" stroke="${dark ? B : N}" stroke-width=".7" opacity="${dark ? '.35' : '.3'}"/>`;
}

const star = (x, y, s, c) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -6 L1.4 -1.4 L6 0 L1.4 1.4 L0 6 L-1.4 1.4 L-6 0 L-1.4 -1.4 Z" fill="${c}"/>`;

function ribbon(name, fill, text) {
  const size = name.length > 12 ? 16 : 19;
  return `
    <path d="M38 280 H212 L202 296 L212 312 H38 L48 296 Z" fill="${fill}"/>
    <path d="M52 284.5 H198" stroke="${B}" stroke-width=".8" opacity=".6"/><path d="M52 307.5 H198" stroke="${B}" stroke-width=".8" opacity=".6"/>
    <text x="125" y="${size === 19 ? 302.5 : 301.5}" text-anchor="middle" font-family="Gloock, Georgia, serif" font-size="${size}" fill="${text}" letter-spacing="-.2">${name}</text>`;
}

function animalCard(c) {
  const id = 'spc' + ++uid;
  return `<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${t('card.ariaNumbered', { name: c.name, n: c.num })}">
    ${frame(id, false)}
    <g clip-path="url(#${id}-win)"><g transform="translate(32 48) scale(.93)">
      ${scenery(id, c.opts)}
      <g transform="translate(0 65) translate(100 148) scale(${c.opts.scale || 1.32}) translate(-100 -148)">${ART[c.key]()}</g>
    </g></g>
    <path d="M32 262 V112 A93 64 0 0 1 218 112 V262 Z" fill="none" stroke="${B}" stroke-width="2"/>
    <path d="M27 266 V112 A98 68 0 0 1 223 112 V266" fill="none" stroke="${N}" stroke-width=".7" opacity=".3"/>
    <text x="25" y="40" text-anchor="middle" font-family="Gloock, Georgia, serif" font-size="22" fill="${N}">${c.num}</text>
    <g transform="rotate(180 125 175)"><text x="25" y="40" text-anchor="middle" font-family="Gloock, Georgia, serif" font-size="22" fill="${N}">${c.num}</text></g>
    ${star(225, 32, 1.1, B)}${star(25, 318, 1.1, B)}
    ${ribbon(c.name, N, C)}
  </svg>`;
}

function peterCard() {
  const id = 'spc' + ++uid;
  const stars = [[30, 40], [64, 22], [150, 30], [176, 66], [118, 54], [20, 92], [184, 112], [92, 30]]
    .map(([x, y], i) => star(x, y, i % 3 ? .6 : .9, B)).join('');
  return `<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${t('card.peterAria')}">
    ${frame(id, true)}
    <defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#232A38"/><stop offset="1" stop-color="#3D4659"/></linearGradient></defs>
    <g clip-path="url(#${id}-win)"><g transform="translate(32 48) scale(.93)">
      <rect width="200" height="230" fill="url(#${id}-sky)"/>
      ${stars}
      <circle cx="150" cy="44" r="17" fill="${C}"/><circle cx="158" cy="38" r="15" fill="#262E3C"/>
      <path d="M-5 190 L60 160 L140 168 L205 150 V240 H-5 Z" fill="#2B3342"/>
      <path d="M-5 200 L100 176 L205 200 V240 H-5 Z" fill="${R}"/>
      <path d="M-5 200 L100 176 L205 200" stroke="${B}" stroke-width="1" opacity=".45" fill="none"/>
      <rect x="138" y="150" width="24" height="42" fill="${ED}"/>
      <rect x="134" y="146" width="32" height="8" fill="#9C3C17"/>
      <path d="M140 160 H160 M140 170 H160 M140 180 H160 M150 154 V160 M144 160 V170 M156 160 V170 M150 170 V180" stroke="${R}" stroke-width="1" opacity=".5"/>
      <path d="M146 140 C140 124 156 116 150 100 C162 110 150 124 158 136" stroke="#8E95A3" stroke-width="4" stroke-linecap="round" opacity=".35" fill="none"/>
      <g fill="${R}">
        <path d="M108 182 C126 182 132 168 124 156" stroke="${R}" stroke-width="6" stroke-linecap="round" fill="none"/>
        <path d="M76 186 C70 158 76 132 92 124 C108 132 114 158 108 186 Z"/>
        <circle cx="92" cy="114" r="17"/>
        <path d="M78 106 L76 86 L90 100 Z"/><path d="M106 106 L108 86 L94 100 Z"/>
      </g>
      <path d="M79 104 L78 92 L86 100 Z M105 104 L106 92 L98 100 Z" fill="${ED}" opacity=".7"/>
      <path d="M80 113 Q85 107 90 113 Q85 117 80 113 Z M94 113 Q99 107 104 113 Q99 117 94 113 Z" fill="${E}"/>
      <path d="M85 109.5 V116.5 M99 109.5 V116.5" stroke="${R}" stroke-width="1.6"/>
      <path d="M92 119 L90 121 H94 Z" fill="${B}"/>
      <g stroke="${C}" stroke-width=".7" opacity=".75"><path d="M84 122 L64 118"/><path d="M84 124 L64 126"/><path d="M100 122 L120 118"/><path d="M100 124 L120 126"/></g>
    </g></g>
    <path d="M32 262 V112 A93 64 0 0 1 218 112 V262 Z" fill="none" stroke="${E}" stroke-width="2"/>
    ${star(25, 32, 1.4, E)}<g transform="rotate(180 125 175)">${star(25, 32, 1.4, E)}</g>
    ${star(225, 32, 1.1, B)}${star(25, 318, 1.1, B)}
    ${ribbon('Schwarzer Peter', E, R)}
  </svg>`;
}

export function render(key) {
  if (key === 'peter') return peterCard();
  const c = DECK.find(d => d.key === key);
  return c ? animalCard(c) : '';
}

export function mountAll(root = document) {
  root.querySelectorAll('[data-card]').forEach(el => { el.innerHTML = render(el.dataset.card); });
}
