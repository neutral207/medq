// Minimal vanilla JS "component" to keep starter light.
export function Dashboard(){
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `
    <h1>MedQ Staff Dashboard</h1>
    <div class="row">
      <div class="card kpi"><strong>Avg Wait:</strong> <span id="avg">--</span> min</div>
      <div class="card kpi"><strong>In Queue:</strong> <span id="q">--</span></div>
      <div class="card kpi"><strong>In Service:</strong> <span id="s">--</span></div>
    </div>
    <h3>Queue</h3>
    <ul id="queue"></ul>
  `;

  fetch('/api/queue').then(r=>r.json()).then(data=>{
    document.getElementById('q').textContent = data.queue.length;
    const ul = el.querySelector('#queue');
    data.queue.forEach(item=>{
      const li = document.createElement('li');
      li.textContent = JSON.stringify(item);
      ul.appendChild(li);
    });
  }).catch(()=>{});

  return el;
}
