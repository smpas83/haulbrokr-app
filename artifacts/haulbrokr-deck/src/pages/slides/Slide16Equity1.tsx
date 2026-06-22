export default function Slide16Equity1() {
  const C = 942.48;
  const founders  = C * 0.80;
  const cto       = C * 0.05;
  const cfo       = C * 0.05;
  const marketing = C * 0.05;
  const employees = C * 0.05;

  const rotFounders  = -90;
  const rotCto       = -90 + 288;
  const rotCfo       = rotCto + 18;
  const rotMarketing = rotCfo + 18;
  const rotEmployees = rotMarketing + 18;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#141414",
        fontFamily: "'Inter', sans-serif",
        color: "#FFFFFF",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "15vh",
          left: 0,
          width: "100vw",
          height: "0.1vh",
          backgroundColor: "#A0785A",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "15vh",
          padding: "0 10vw",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
          <div style={{ fontSize: "0.75vw", fontWeight: 500, color: "#A0785A", textTransform: "uppercase", letterSpacing: "0.25em" }}>
            09 — Equity Structure
          </div>
          <h2 style={{ fontSize: "2.4vw", fontWeight: 300, margin: 0, letterSpacing: "0.02em" }}>
            Ownership at a Glance
          </h2>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          height: "75vh",
          padding: "4vh 10vw",
          gap: "6vw",
          alignItems: "center",
        }}
      >
        <div style={{ flex: "0 0 34vw", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 400 400" width="34vw" height="34vw">
            <circle
              cx="200" cy="200" r="150"
              fill="none" strokeWidth="60"
              stroke="#2d3f5c"
              strokeDasharray={`${founders} ${C - founders}`}
              transform={`rotate(${rotFounders}, 200, 200)`}
            />
            <circle
              cx="200" cy="200" r="150"
              fill="none" strokeWidth="60"
              stroke="#f5c842"
              strokeDasharray={`${cto} ${C - cto}`}
              transform={`rotate(${rotCto}, 200, 200)`}
            />
            <circle
              cx="200" cy="200" r="150"
              fill="none" strokeWidth="60"
              stroke="#d4820a"
              strokeDasharray={`${cfo} ${C - cfo}`}
              transform={`rotate(${rotCfo}, 200, 200)`}
            />
            <circle
              cx="200" cy="200" r="150"
              fill="none" strokeWidth="60"
              stroke="#e9a600"
              strokeDasharray={`${marketing} ${C - marketing}`}
              transform={`rotate(${rotMarketing}, 200, 200)`}
            />
            <circle
              cx="200" cy="200" r="150"
              fill="none" strokeWidth="60"
              stroke="#fde68a"
              strokeDasharray={`${employees} ${C - employees}`}
              transform={`rotate(${rotEmployees}, 200, 200)`}
            />
            <text x="200" y="190" textAnchor="middle" fill="#FFFFFF" fontSize="52" fontWeight="200" fontFamily="Inter, sans-serif">80%</text>
            <text x="200" y="230" textAnchor="middle" fill="#888888" fontSize="22" fontFamily="Inter, sans-serif">Founders</text>
          </svg>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "2.8vh",
          }}
        >
          <div style={{ fontSize: "1vw", fontWeight: 500, color: "#A0785A", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.5vh" }}>
            Cap Table Summary
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "2vw", borderBottom: "0.1vh solid #222222", paddingBottom: "2vh" }}>
            <div style={{ width: "1.2vw", height: "1.2vw", backgroundColor: "#2d3f5c", flexShrink: 0 }} />
            <span style={{ fontSize: "1.2vw", color: "#FFFFFF", flex: 1 }}>Founders (retained)</span>
            <span style={{ fontSize: "1.5vw", fontWeight: 300, color: "#FFFFFF" }}>80%</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "2vw", borderBottom: "0.1vh solid #222222", paddingBottom: "2vh" }}>
            <div style={{ width: "1.2vw", height: "1.2vw", backgroundColor: "#f5c842", flexShrink: 0 }} />
            <span style={{ fontSize: "1.2vw", color: "#888888", flex: 1 }}>CTO Partner</span>
            <span style={{ fontSize: "1.5vw", fontWeight: 300, color: "#f5c842" }}>5%</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "2vw", borderBottom: "0.1vh solid #222222", paddingBottom: "2vh" }}>
            <div style={{ width: "1.2vw", height: "1.2vw", backgroundColor: "#d4820a", flexShrink: 0 }} />
            <span style={{ fontSize: "1.2vw", color: "#888888", flex: 1 }}>CFO Partner</span>
            <span style={{ fontSize: "1.5vw", fontWeight: 300, color: "#d4820a" }}>5%</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "2vw", borderBottom: "0.1vh solid #222222", paddingBottom: "2vh" }}>
            <div style={{ width: "1.2vw", height: "1.2vw", backgroundColor: "#e9a600", flexShrink: 0 }} />
            <span style={{ fontSize: "1.2vw", color: "#888888", flex: 1 }}>VP Marketing</span>
            <span style={{ fontSize: "1.5vw", fontWeight: 300, color: "#e9a600" }}>5%</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "2vw" }}>
            <div style={{ width: "1.2vw", height: "1.2vw", backgroundColor: "#fde68a", flexShrink: 0 }} />
            <span style={{ fontSize: "1.2vw", color: "#888888", flex: 1 }}>Employee Option Pool</span>
            <span style={{ fontSize: "1.5vw", fontWeight: 300, color: "#fde68a" }}>5%</span>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "4vh",
          left: "10vw",
          right: "10vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.8vw",
          fontWeight: 500,
          color: "#666666",
          textTransform: "uppercase",
          letterSpacing: "0.2em",
        }}
      >
        <span>HaulBrokr&nbsp;&bull;&nbsp;Confidential&nbsp;&bull;&nbsp;2026</span>
        <span style={{ color: "#A0785A" }}>16</span>
      </div>
    </div>
  );
}
