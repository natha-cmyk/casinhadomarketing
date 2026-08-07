"use client";
// Portado de viewPersona (blueprint 1517-1598). Personas, receita por produto,
// carrossel estilo Tinder e insights estratégicos. Dados em lib/seed-data.
import { useStore } from "@/lib/store";
import {
  PERSONA_KPIS,
  PERSONA_PRODUTOS,
  PERSONAS,
  PERSONA_INSIGHTS,
} from "@/lib/seed-data";
import { Card, KpiCard, PageHead } from "@/components/ui";
import { Ic } from "@/components/Ic";

const INSIGHT_COLORS = ["var(--red)", "var(--cyan)", "var(--excelente)", "var(--atencao)"];

export default function PersonaView() {
  const personaIdx = useStore((s) => s.personaIdx);
  const personaPhotos = useStore((s) => s.personaPhotos);
  const set = useStore((s) => s.set);

  const N = PERSONAS.length;
  const i = Math.min(personaIdx || 0, N - 1);
  const p = PERSONAS[i];
  const photo = personaPhotos[i];

  return (
    <>
      <PageHead
        eyebrow="Estratégia · Inteligência de Personas"
        title="Persona & Público"
        desc="Do estudo compartilhado (Conexa + Chatwoot + ClickUp CRM · extração 07/2026). Dois níveis: persona de marca (P0) e personas de conversão por produto (P1–P4)."
      />

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        {PERSONA_KPIS.map(([l, v, f]) => (
          <KpiCard key={l} lbl={l} val={v} foot={f} />
        ))}
      </div>

      <Card padLg style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="t">Receita por produto</div>
            <div className="sub">a receita está na Sala; o EF é volume e porta de entrada</div>
          </div>
        </div>
        {PERSONA_PRODUTOS.map(([n, c, m, d]) => (
          <div key={n} className="bar-row" style={{ gridTemplateColumns: "180px 90px 110px 1fr" }}>
            <div className="k">{n}</div>
            <div className="v tnum" style={{ textAlign: "left" }}>{c}</div>
            <div className="v tnum" style={{ textAlign: "left" }}>{m}</div>
            <div style={{ fontSize: "11.5px", color: "var(--label-3)" }}>{d}</div>
          </div>
        ))}
      </Card>

      <div className="card ptinder" style={{ marginBottom: 6 }}>
        <div className="pt-photo" style={{ background: p.cover }}>
          {photo && (
            <img
              key={photo}
              src={photo}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <span className="pt-emoji">{p.emoji}</span>
          <div className="pt-photoedit">
            <input
              value={photo || ""}
              placeholder="colar URL da foto da persona"
              autoComplete="off"
              onChange={(e) => set({ personaPhotos: { ...personaPhotos, [i]: e.target.value } })}
            />
          </div>
        </div>
        <div className="pt-body">
          <div>
            <div className="pt-tag">{p.tag}</div>
            <h3 className="pt-name">{p.name}</h3>
            <div className="pt-handle">{p.handle}</div>
          </div>
          <div className="pt-sec">
            <div className="pt-l">Quem representa</div>
            <p>{p.representa}</p>
          </div>
          <div className="pt-sec">
            <div className="pt-l">O que comunica</div>
            <p>{p.comunica}</p>
          </div>
          <div className="pt-sec">
            <div className="pt-l">Dores</div>
            <div className="pt-dores">
              {p.dores.map((d, j) => (
                <span key={j} className="pt-dore">{d}</span>
              ))}
            </div>
          </div>
          <div className="pt-sec">
            <div className="pt-l">Canais</div>
            <p>{p.canais}</p>
          </div>
          <div className="pt-sec">
            <div className="pt-l">Gatilho de conversão</div>
            <p>{p.gatilho}</p>
          </div>
          <div className="pt-stats">
            {p.stats.map((a, j) => (
              <div key={j} className="pt-stat">
                <b>{a[0]}</b>
                <span>{a[1]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="pt-nav">
        <button onClick={() => set({ personaIdx: (i - 1 + N) % N })} aria-label="Persona anterior">‹</button>
        <div className="pt-dots">
          {PERSONAS.map((_, j) => (
            <button
              key={j}
              className={`pt-dot ${j === i ? "on" : ""}`}
              onClick={() => set({ personaIdx: j })}
              aria-label={`Persona ${j + 1}`}
            />
          ))}
        </div>
        <button onClick={() => set({ personaIdx: (i + 1) % N })} aria-label="Próxima persona">›</button>
      </div>

      <Card padLg>
        <div className="card-head">
          <div>
            <div className="t">Insights estratégicos</div>
            <div className="sub">reordenados por alavanca de resultado</div>
          </div>
        </div>
        {PERSONA_INSIGHTS.map(([t, d], idx) => (
          <div key={idx} className="insight" style={{ marginBottom: idx < PERSONA_INSIGHTS.length - 1 ? 10 : 0 }}>
            <div className="ib" style={{ background: INSIGHT_COLORS[idx] }}>
              <Ic name="goal" />
            </div>
            <p>
              <b>{t}.</b> {d}
            </p>
          </div>
        ))}
      </Card>
      <Card style={{ marginTop: 16 }}>
        <div className="insight" style={{ border: 0, background: "transparent", padding: 0 }}>
          <div className="ib" style={{ background: "var(--atencao)" }}>
            <Ic name="persona" />
          </div>
          <p>
            <b>Higiene de base é prioridade:</b> 45% do Conexa e 96% do CRM sem ramo informado. Lead com segmento conhecido converte 80%+; sem segmento, 28,8%. Capturar o segmento no primeiro toque vale mais que qualquer criativo novo.
          </p>
        </div>
      </Card>
    </>
  );
}
