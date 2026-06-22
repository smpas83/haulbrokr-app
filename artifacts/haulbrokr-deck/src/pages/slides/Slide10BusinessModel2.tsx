export default function Slide10BusinessModel2() {
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
            05 — Business Model
          </div>
          <h2 style={{ fontSize: "2.4vw", fontWeight: 300, margin: 0, letterSpacing: "0.02em" }}>
            Unit Economics
          </h2>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          height: "75vh",
          padding: "6vh 10vw",
          gap: "8vw",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "4vh" }}>
          <h3 style={{ fontSize: "1.3vw", fontWeight: 500, color: "#A0785A", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
            Per-Job Economics (avg. job value $850)
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "2vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.1vh solid #222222", paddingBottom: "1.5vh" }}>
              <span style={{ fontSize: "1.2vw", color: "#888888" }}>Gross job value</span>
              <span style={{ fontSize: "1.2vw", color: "#FFFFFF" }}>$850</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.1vh solid #222222", paddingBottom: "1.5vh" }}>
              <span style={{ fontSize: "1.2vw", color: "#888888" }}>Platform take (15%)</span>
              <span style={{ fontSize: "1.2vw", color: "#A0785A" }}>$127.50</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.1vh solid #222222", paddingBottom: "1.5vh" }}>
              <span style={{ fontSize: "1.2vw", color: "#888888" }}>Payment processing cost (~1.5%)</span>
              <span style={{ fontSize: "1.2vw", color: "#666666" }}>—$13</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.1vh solid #222222", paddingBottom: "1.5vh" }}>
              <span style={{ fontSize: "1.2vw", color: "#888888" }}>Variable platform cost</span>
              <span style={{ fontSize: "1.2vw", color: "#666666" }}>—$4</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.5vh" }}>
              <span style={{ fontSize: "1.4vw", fontWeight: 500, color: "#FFFFFF" }}>Net contribution per job</span>
              <span style={{ fontSize: "1.6vw", fontWeight: 500, color: "#A0785A" }}>$110</span>
            </div>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            borderLeft: "0.1vh solid #333333",
            paddingLeft: "5vw",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "4vh",
          }}
        >
          <h3 style={{ fontSize: "1.3vw", fontWeight: 500, color: "#A0785A", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
            Scale Targets
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "3.5vh" }}>
            <div>
              <div style={{ fontSize: "0.9vw", color: "#666666", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1vh" }}>Year 1 — Houston Pilot</div>
              <div style={{ display: "flex", gap: "4vw" }}>
                <div>
                  <div style={{ fontSize: "2.5vw", fontWeight: 200, color: "#FFFFFF" }}>500</div>
                  <div style={{ fontSize: "0.9vw", color: "#666666" }}>active operators</div>
                </div>
                <div>
                  <div style={{ fontSize: "2.5vw", fontWeight: 200, color: "#FFFFFF" }}>$4.2M</div>
                  <div style={{ fontSize: "0.9vw", color: "#666666" }}>GMV target</div>
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.9vw", color: "#666666", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1vh" }}>Year 3 — Statewide Texas</div>
              <div style={{ display: "flex", gap: "4vw" }}>
                <div>
                  <div style={{ fontSize: "2.5vw", fontWeight: 200, color: "#A0785A" }}>15K</div>
                  <div style={{ fontSize: "0.9vw", color: "#666666" }}>active operators</div>
                </div>
                <div>
                  <div style={{ fontSize: "2.5vw", fontWeight: 200, color: "#A0785A" }}>$480M</div>
                  <div style={{ fontSize: "0.9vw", color: "#666666" }}>GMV target</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: "3vh 2.5vw", backgroundColor: "#1A1A1A", borderLeft: "0.3vh solid #A0785A" }}>
            <div style={{ fontSize: "1vw", color: "#888888", lineHeight: 1.6 }}>
              At 15,000 operators averaging 3 jobs/week, the platform generates over $48M annual net contribution before SaaS and embedded finance revenue.
            </div>
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
        <span style={{ color: "#A0785A" }}>10</span>
      </div>
    </div>
  );
}
