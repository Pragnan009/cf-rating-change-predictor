const API_BASE = (window.CF_API_BASE || "").replace(/\/$/, "");

const form = document.getElementById("predict-form");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

// Same tier scale used in style.css's gradient, kept in sync manually here
// (min rating, max rating, color) so the JS-computed marker positions line
// up with the CSS bar.
const TIERS = [
  { max: 1200, color: "var(--tier-gray)" },
  { max: 1400, color: "var(--tier-green)" },
  { max: 1600, color: "var(--tier-cyan)" },
  { max: 1900, color: "var(--tier-blue)" },
  { max: 2100, color: "var(--tier-purple)" },
  { max: 2400, color: "var(--tier-orange)" },
  { max: 3500, color: "var(--tier-red)" },
];
const BAR_MIN = 0;
const BAR_MAX = 3000;

function pct(rating) {
  const clamped = Math.max(BAR_MIN, Math.min(BAR_MAX, rating));
  return ((clamped - BAR_MIN) / (BAR_MAX - BAR_MIN)) * 100;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const handle = document.getElementById("handle").value.trim();
  const contest = document.getElementById("contest").value.trim();
  const rank = document.getElementById("rank").value.trim();

  resultEl.classList.add("hidden");
  statusEl.classList.remove("error");
  statusEl.textContent = "Fetching contest data...";

  const params = new URLSearchParams({ handle, contest });
  if (rank) params.set("rank", rank);

  const submitBtn = form.querySelector("button");
  submitBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/predict?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      statusEl.classList.add("error");
      statusEl.textContent = data.detail || "Something went wrong.";
      return;
    }

    render(data);
    statusEl.textContent = "";
  } catch (err) {
    statusEl.classList.add("error");
    statusEl.textContent = "Couldn't reach the server. Try again in a moment.";
  } finally {
    submitBtn.disabled = false;
  }
});

function render(r) {
  resultEl.classList.remove("hidden");

  const deltaClass = r.predicted_delta > 0 ? "pos" : r.predicted_delta < 0 ? "neg" : "flat";
  const deltaSign = r.predicted_delta > 0 ? "+" : "";

  const oldPct = pct(r.old_rating);
  const newPct = pct(r.predicted_new_rating);
  const lowPct = pct(r.low_estimate);
  const highPct = pct(r.high_estimate);

  resultEl.innerHTML = `
    <div class="result-headline">
      <span class="rating">${r.predicted_new_rating}</span>
      <span class="delta ${deltaClass}">${deltaSign}${r.predicted_delta}</span>
    </div>
    <div class="result-sub">
      ${r.handle} · ${r.old_rating}${r.is_unrated_user ? " (unrated)" : ""} → ${r.predicted_new_rating} · rank ${r.rank_used} of ${r.field_size + 1}
    </div>

    <div class="tier-bar-wrap">
      <div class="tier-bar">
        <div class="tier-range" style="left:${lowPct}%; width:${highPct - lowPct}%;"></div>
        <div class="tier-marker old" style="left:${oldPct}%;" title="Current rating"></div>
        <div class="tier-marker" style="left:${newPct}%;" title="Predicted rating"></div>
      </div>
      <div class="tier-labels"><span>0</span><span>1200</span><span>1600</span><span>2100</span><span>3000</span></div>
    </div>

    <dl class="detail-grid">
      <div><dt>Mode</dt><dd>${r.mode === "live" ? "Live" : "Validation (contest already rated)"}</dd></div>
      <div><dt>Estimated range</dt><dd>${r.low_estimate} – ${r.high_estimate}</dd></div>
      ${r.actual_delta !== null ? `<div><dt>Actual delta</dt><dd>${r.actual_delta > 0 ? "+" : ""}${r.actual_delta}</dd></div>
      <div><dt>Prediction error</dt><dd>${Math.abs(r.actual_delta - r.predicted_delta)} pts</dd></div>` : ""}
    </dl>

    ${r.notes && r.notes.length ? `<div class="notes">${r.notes.join("<br>")}</div>` : ""}
  `;
}
