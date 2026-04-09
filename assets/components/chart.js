const chartStore = new Map();

export function destroyChart(id) {
  const existing = chartStore.get(id);
  if (existing) {
    existing.destroy();
    chartStore.delete(id);
  }
}

export function renderBarChart({ id, labels, values, label }) {
  const canvas = document.getElementById(id);
  if (!canvas || !window.Chart) return;

  destroyChart(id);
  const ctx = canvas.getContext("2d");

  // Create gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, "rgba(99, 102, 241, 0.9)");
  gradient.addColorStop(1, "rgba(139, 92, 246, 0.6)");

  const textColor = window.getComputedStyle(document.body).getPropertyValue('--muted') || "#94a3b8";
  const gridColor = window.getComputedStyle(document.body).getPropertyValue('--border-light') || "rgba(255,255,255,0.05)";

  const chart = new window.Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label,
        data: values,
        borderRadius: 8,
        backgroundColor: gradient,
        hoverBackgroundColor: "rgba(99, 102, 241, 1)",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { labels: { color: textColor, font: { family: 'Inter', weight: 600 } } },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          titleColor: "#f1f5f9",
          bodyColor: "#f1f5f9",
          padding: 12,
          cornerRadius: 8,
          titleFont: { family: 'Inter', weight: 'bold' }
        }
      },
      scales: {
        x: { ticks: { color: textColor, font: { family: 'Inter' } }, grid: { display: false } },
        y: { ticks: { color: textColor, font: { family: 'Inter' } }, grid: { color: gridColor }, border: { dash: [4, 4] } },
      },
    },
  });

  chartStore.set(id, chart);
}
