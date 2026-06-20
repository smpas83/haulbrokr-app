export default function Slide13Technology() {
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
            07 — Technology
          </div>
          <h2 style={{ fontSize: "2.4vw", fontWeight: 300, margin: 0, letterSpacing: "0.02em" }}>
            Built for Scale, Day One
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
          <p style={{ fontSize: "1.4vw", fontWeight: 300, color: "#FFFFFF", lineHeight: 1.6, margin: 0 }}>
            The platform is built on a modern, cloud-native stack designed to handle tens of thousands of concurrent jobs across multiple states.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "2.5vh" }}>
            <div style={{ display: "flex", gap: "2vw" }}>
              <div style={{ flex: 1, backgroundColor: "#1A1A1A", padding: "2.5vh 2vw", borderTop: "0.2vh solid #A0785A" }}>
                <div style={{ fontSize: "0.85vw", color: "#A0785A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1vh" }}>Mobile</div>
                <div style={{ fontSize: "1vw", color: "#FFFFFF", marginBottom: "0.5vh" }}>React Native / Expo</div>
                <div style={{ fontSize: "0.9vw", color: "#666666" }}>iOS + Android from one codebase</div>
              </div>
              <div style={{ flex: 1, backgroundColor: "#1A1A1A", padding: "2.5vh 2vw", borderTop: "0.2vh solid #333333" }}>
                <div style={{ fontSize: "0.85vw", color: "#888888", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1vh" }}>Backend</div>
                <div style={{ fontSize: "1vw", color: "#FFFFFF", marginBottom: "0.5vh" }}>Node.js / PostgreSQL</div>
                <div style={{ fontSize: "0.9vw", color: "#666666" }}>REST API, real-time WebSocket layer</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "2vw" }}>
              <div style={{ flex: 1, backgroundColor: "#1A1A1A", padding: "2.5vh 2vw", borderTop: "0.2vh solid #333333" }}>
                <div style={{ fontSize: "0.85vw", color: "#888888", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1vh" }}>Mapping</div>
                <div style={{ fontSize: "1vw", color: "#FFFFFF", marginBottom: "0.5vh" }}>Google Maps Platform</div>
                <div style={{ fontSize: "0.9vw", color: "#666666" }}>Live GPS, ETA, geofenced tickets</div>
              </div>
              <div style={{ flex: 1, backgroundColor: "#1A1A1A", padding: "2.5vh 2vw", borderTop: "0.2vh solid #333333" }}>
                <div style={{ fontSize: "0.85vw", color: "#888888", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1vh" }}>Payments</div>
                <div style={{ fontSize: "1vw", color: "#FFFFFF", marginBottom: "0.5vh" }}>Stripe Connect</div>
                <div style={{ fontSize: "0.9vw", color: "#666666" }}>Marketplace splits, same-day ACH</div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            flex: "0 0 28vw",
            borderLeft: "0.1vh solid #333333",
            paddingLeft: "5vw",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "3.5vh",
          }}
        >
          <div style={{ fontSize: "1.1vw", fontWeight: 500, color: "#A0785A", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Moat &amp; Defensibility
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
            <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#A0785A", marginTop: "0.8vh", flexShrink: 0 }} />
            <span style={{ fontSize: "1.1vw", color: "#888888", lineHeight: 1.5 }}>
              Two-sided liquidity is the hardest thing to replicate — once both sides are entrenched, switching cost is high.
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
            <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#A0785A", marginTop: "0.8vh", flexShrink: 0 }} />
            <span style={{ fontSize: "1.1vw", color: "#888888", lineHeight: 1.5 }}>
              Proprietary compliance database — operator vetting data compounds over time, increasing quality signal for new matches.
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
            <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#A0785A", marginTop: "0.8vh", flexShrink: 0 }} />
            <span style={{ fontSize: "1.1vw", color: "#888888", lineHeight: 1.5 }}>
              Load ticket history creates a financial paper trail that embedded finance products can underwrite against.
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
            <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#A0785A", marginTop: "0.8vh", flexShrink: 0 }} />
            <span style={{ fontSize: "1.1vw", color: "#888888", lineHeight: 1.5 }}>
              White-label SaaS locks brokers into the stack — their driver rosters become a distribution channel for the marketplace.
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
        <span style={{ color: "#A0785A" }}>13</span>
      </div>
    </div>
  );
}
