export default function Slide08Market2() {
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
          <div
            style={{
              fontSize: "0.75vw",
              fontWeight: 500,
              color: "#A0785A",
              textTransform: "uppercase",
              letterSpacing: "0.25em",
            }}
          >
            04 — Market Opportunity
          </div>
          <h2
            style={{
              fontSize: "2.4vw",
              fontWeight: 300,
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            U.S. Nationwide. Then the World.
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
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "4vh",
          }}
        >
          <p
            style={{
              fontSize: "1.5vw",
              fontWeight: 300,
              color: "#FFFFFF",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            The U.S. has over 500,000 licensed commercial dump truck operators across all 50 states — none connected by a single digital dispatch platform. Texas is the beachhead; national coverage is the mission.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "2.5vh" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "0.1vh solid #222222",
                paddingBottom: "1.5vh",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
                <div style={{ width: "0.8vw", height: "0.8vw", backgroundColor: "#A0785A" }} />
                <span style={{ fontSize: "1.2vw", color: "#FFFFFF" }}>Texas (Houston, DFW, SA/Austin)</span>
              </div>
              <span style={{ fontSize: "1.1vw", color: "#A0785A" }}>Phase 1 — 2025–2026</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "0.1vh solid #222222",
                paddingBottom: "1.5vh",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
                <div style={{ width: "0.8vw", height: "0.8vw", backgroundColor: "#888888" }} />
                <span style={{ fontSize: "1.2vw", color: "#888888" }}>Sun Belt + Northeast + Midwest</span>
              </div>
              <span style={{ fontSize: "1.1vw", color: "#666666" }}>Phase 2 — 2027 (Series A)</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "0.1vh solid #222222",
                paddingBottom: "1.5vh",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
                <div style={{ width: "0.8vw", height: "0.8vw", backgroundColor: "#555555" }} />
                <span style={{ fontSize: "1.2vw", color: "#666666" }}>All 50 U.S. States</span>
              </div>
              <span style={{ fontSize: "1.1vw", color: "#555555" }}>Phase 3 — 2028</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "0.1vh solid #222222",
                paddingBottom: "1.5vh",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
                <div style={{ width: "0.8vw", height: "0.8vw", backgroundColor: "#333333" }} />
                <span style={{ fontSize: "1.2vw", color: "#555555" }}>Canada &amp; Mexico</span>
              </div>
              <span style={{ fontSize: "1.1vw", color: "#444444" }}>Phase 4 — 2029</span>
            </div>
          </div>
        </div>

        <div
          style={{
            flex: "0 0 30vw",
            borderLeft: "0.1vh solid #333333",
            paddingLeft: "5vw",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "4vh",
          }}
        >
          <div style={{ fontSize: "1.1vw", fontWeight: 500, color: "#A0785A", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            International Vision
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
            <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#A0785A", marginTop: "0.8vh", flexShrink: 0 }} />
            <span style={{ fontSize: "1.1vw", color: "#888888", lineHeight: 1.5 }}>
              <strong style={{ color: "#FFFFFF" }}>Canada:</strong> Cross-border construction boom; regulatory alignment with U.S. standards makes entry low-friction.
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
            <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#A0785A", marginTop: "0.8vh", flexShrink: 0 }} />
            <span style={{ fontSize: "1.1vw", color: "#888888", lineHeight: 1.5 }}>
              <strong style={{ color: "#FFFFFF" }}>Mexico:</strong> $45B infrastructure investment pipeline; massive unserved dump truck market with no digital dispatch layer.
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
            <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#A0785A", marginTop: "0.8vh", flexShrink: 0 }} />
            <span style={{ fontSize: "1.1vw", color: "#888888", lineHeight: 1.5 }}>
              <strong style={{ color: "#FFFFFF" }}>Worldwide:</strong> The dispatch problem is global — Europe, LatAm, and Southeast Asia represent long-term expansion runways.
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
            <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#A0785A", marginTop: "0.8vh", flexShrink: 0 }} />
            <span style={{ fontSize: "1.1vw", color: "#888888", lineHeight: 1.5 }}>
              Platform architecture is internationalization-ready — multi-currency, multi-language from day one.
            </span>
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
        <span style={{ color: "#A0785A" }}>08</span>
      </div>
    </div>
  );
}
