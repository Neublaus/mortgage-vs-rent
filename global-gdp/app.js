const WB_DATA_URL = 'https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?format=json&date=1960:2024&per_page=20000';
const WB_COUNTRIES_URL = 'https://api.worldbank.org/v2/country?format=json&per_page=400';

const REGION_COLORS = {
  'East Asia & Pacific': '#f04444',
  'South Asia': '#ef4545',
  'Europe & Central Asia': '#43b97b',
  'North America': '#349aa5',
  'Latin America & Caribbean': '#2f8492',
  'Middle East & North Africa': '#91b678',
  'Sub-Saharan Africa': '#6b9f73',
  'Other': '#78909c'
};

const state = { dataByYear: new Map(), meta: new Map(), year: 2024, timer: null, speed: 650 };
const svg = d3.select('#chart');
const tooltip = document.querySelector('#tooltip');
const loading = document.querySelector('#loading');
const slider = document.querySelector('#yearSlider');
const playBtn = document.querySelector('#playBtn');
const speedSelect = document.querySelector('#speedSelect');

function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'Microsoft Edge';
  if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera';
  if (ua.includes('Chrome/')) return 'Google Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
  if (ua.includes('Firefox/')) return 'Firefox';
  return 'Web browser';
}
document.querySelector('#browserBadge').textContent = detectBrowser();

function formatMoney(value) {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(value >= 10e12 ? 1 : 2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(value >= 100e9 ? 0 : 1)}B`;
  return `$${(value / 1e6).toFixed(0)}M`;
}

async function loadData() {
  const [metaResponse, gdpResponse] = await Promise.all([fetch(WB_COUNTRIES_URL), fetch(WB_DATA_URL)]);
  if (!metaResponse.ok || !gdpResponse.ok) throw new Error('World Bank API request failed');
  const metaJson = await metaResponse.json();
  const gdpJson = await gdpResponse.json();

  metaJson[1].forEach(country => {
    if (country.region?.id !== 'NA') {
      state.meta.set(country.id, {
        name: country.name,
        region: country.region.value || 'Other',
        iso3: country.id
      });
    }
  });

  gdpJson[1].forEach(row => {
    const year = Number(row.date);
    const value = Number(row.value);
    const iso3 = row.countryiso3code;
    if (!state.meta.has(iso3) || !Number.isFinite(value) || value <= 0) return;
    if (!state.dataByYear.has(year)) state.dataByYear.set(year, []);
    state.dataByYear.get(year).push({ ...state.meta.get(iso3), value });
  });
}

function buildHierarchy(year) {
  const rows = state.dataByYear.get(year) || [];
  const grouped = d3.group(rows, d => d.region);
  return {
    name: 'World',
    children: Array.from(grouped, ([region, countries]) => ({ name: region, children: countries }))
  };
}

function render(year, animate = true) {
  state.year = year;
  slider.value = year;
  document.querySelector('#headlineYear').textContent = year;
  document.querySelector('#selectedYear').textContent = year;
  document.querySelector('#rankingYear').textContent = year;

  const bounds = document.querySelector('.chart-card').getBoundingClientRect();
  const width = Math.max(640, bounds.width);
  const height = Math.max(520, bounds.height);
  svg.attr('viewBox', `0 0 ${width} ${height}`);

  const root = d3.hierarchy(buildHierarchy(year))
    .sum(d => d.value || 0)
    .sort((a, b) => b.value - a.value);

  d3.pack().size([width - 24, height - 24]).padding(d => d.depth === 1 ? 8 : 2.5)(root);

  const countries = root.leaves();
  const transition = svg.transition().duration(animate ? Math.min(state.speed * .8, 700) : 0).ease(d3.easeCubicOut);
  const nodes = svg.selectAll('g.node').data(countries, d => d.data.iso3);

  const enter = nodes.enter().append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .style('opacity', 0)
    .on('pointerenter', (event, d) => showTooltip(event, d))
    .on('pointermove', (event, d) => showTooltip(event, d))
    .on('pointerleave', hideTooltip);

  enter.append('circle').attr('r', 0).attr('fill', d => REGION_COLORS[d.data.region] || REGION_COLORS.Other);
  enter.append('text').attr('class', 'country-label');
  enter.append('text').attr('class', 'value-label');

  const merged = enter.merge(nodes);
  merged.transition(transition).attr('transform', d => `translate(${d.x + 12},${d.y + 12})`).style('opacity', 1);
  merged.select('circle').transition(transition).attr('r', d => d.r);

  merged.select('.country-label')
    .attr('y', d => d.r > 44 ? -3 : 3)
    .style('font-size', d => `${Math.max(8, Math.min(24, d.r / 4.5))}px`)
    .text(d => d.r > 20 ? abbreviate(d.data.name, d.r) : '');

  merged.select('.value-label')
    .attr('y', d => d.r > 44 ? Math.max(13, d.r / 7) : 0)
    .style('font-size', d => `${Math.max(8, Math.min(15, d.r / 7))}px`)
    .text(d => d.r > 42 ? formatMoney(d.value) : '');

  nodes.exit().transition(transition).style('opacity', 0).select('circle').attr('r', 0);
  nodes.exit().transition(transition).remove();

  const regions = root.children || [];
  const regionLabels = svg.selectAll('text.region-label').data(regions, d => d.data.name);
  regionLabels.join(
    enter => enter.append('text').attr('class', 'region-label').style('opacity', 0),
    update => update,
    exit => exit.remove()
  ).transition(transition)
    .attr('x', d => d.x + 12)
    .attr('y', d => Math.max(18, d.y - d.r + 26))
    .attr('text-anchor', 'middle')
    .style('opacity', 1)
    .text(d => d.data.name.toUpperCase());

  renderRanking(countries);
}

function abbreviate(name, radius) {
  const aliases = { 'United States': 'United States', 'United Kingdom': 'UK', 'Russian Federation': 'Russia', 'Korea, Rep.': 'South Korea', 'Iran, Islamic Rep.': 'Iran', 'Egypt, Arab Rep.': 'Egypt', 'Venezuela, RB': 'Venezuela', 'Hong Kong SAR, China': 'Hong Kong' };
  const value = aliases[name] || name;
  const max = Math.max(4, Math.floor(radius / 4.2));
  return value.length > max ? value.slice(0, Math.max(3, max - 1)) + '…' : value;
}

function renderRanking(countries) {
  const list = document.querySelector('#rankingList');
  list.innerHTML = countries.slice(0, 18).map(d => `
    <li>
      <span class="rank-name">${d.data.name}</span>
      <span class="rank-value">${formatMoney(d.value)}</span>
    </li>`).join('');
}

function showTooltip(event, d) {
  tooltip.hidden = false;
  tooltip.innerHTML = `<strong>${d.data.name}</strong><span>${d.data.region}</span><br><span>${state.year}: ${formatMoney(d.value)}</span><br><span>${((d.value / d.parent.parent.value) * 100).toFixed(2)}% of world GDP</span>`;
  tooltip.style.left = `${event.clientX + 14}px`;
  tooltip.style.top = `${event.clientY + 14}px`;
}
function hideTooltip() { tooltip.hidden = true; }

function stop() {
  clearInterval(state.timer);
  state.timer = null;
  playBtn.textContent = '▶';
  playBtn.setAttribute('aria-label', 'Play animation');
}
function play() {
  if (state.timer) return stop();
  if (state.year >= 2024) render(1960);
  playBtn.textContent = '❚❚';
  playBtn.setAttribute('aria-label', 'Pause animation');
  state.timer = setInterval(() => {
    if (state.year >= 2024) return stop();
    render(state.year + 1);
  }, state.speed);
}

slider.addEventListener('input', e => { stop(); render(Number(e.target.value)); });
playBtn.addEventListener('click', play);
speedSelect.addEventListener('change', e => {
  state.speed = Number(e.target.value);
  if (state.timer) { stop(); play(); }
});
document.querySelector('#fullscreenBtn').addEventListener('click', async () => {
  if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  else await document.exitFullscreen();
});
window.addEventListener('resize', () => render(state.year, false));

loadData().then(() => {
  loading.remove();
  while (!state.dataByYear.has(state.year) && state.year > 1960) state.year--;
  slider.max = state.year;
  document.querySelector('.timeline-labels span:last-child').textContent = state.year;
  render(state.year, false);
}).catch(error => {
  loading.textContent = 'Could not load World Bank data. Check your internet connection and reload.';
  console.error(error);
});
