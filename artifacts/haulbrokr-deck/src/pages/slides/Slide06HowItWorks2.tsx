export default function Slide06HowItWorks2() {
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
            03 — How It Works
          </div>
          <h2
            style={{
              fontSize: "2.4vw",
              fontWeight: 300,
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            Platform Feature Set
          </h2>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          height: "75vh",
          padding: "6vh 10vw",
          gap: "4vw",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3vh" }}>
          <div
            style={{
              backgroundColor: "#1A1A1A",
              padding: "3vh 2.5vw",
              borderLeft: "0.3vh solid #A0785A",
            }}
          >
            <div style={{ fontSize: "1.2vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "1vh" }}>
              Real-Time GPS Tracking
            </div>
            <div style={{ fontSize: "1vw", color: "#888888", lineHeight: 1.5 }}>
              Contractors watch every truck on a live map. ETAs auto-calculate. No more "where are you?" calls.
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#1A1A1A",
              padding: "3vh 2.5vw",
              borderLeft: "0.3vh solid #333333",
            }}
          >
            <div style={{ fontSize: "1.2vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "1vh" }}>
              Digital Load Tickets
            </div>
            <div style={{ fontSize: "1vw", color: "#888888", lineHeight: 1.5 }}>
              Each dump cycle generates a geo-stamped ticket. Load counts are tamper-proof and dispute-free.
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#1A1A1A",
              padding: "3vh 2.5vw",
              borderLeft: "0.3vh solid #333333",
            }}
          >
            <div style={{ fontSize: "1.2vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "1vh" }}>
              Compliance Verification
            </div>
            <div style={{ fontSize: "1vw", color: "#888888", lineHeight: 1.5 }}>
              Every operator is screened for DOT compliance, CDL status, and liability insurance before first dispatch.
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3vh" }}>
          <div
            style={{
              backgroundColor: "#1A1A1A",
              padding: "3vh 2.5vw",
              borderLeft: "0.3vh solid #333333",
            }}
          >
            <div style={{ fontSize: "1.2vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "1vh" }}>
              Integrated Payments
            </div>
            <div style={{ fontSize: "1vw", color: "#888888", lineHeight: 1.5 }}>
              In-app ACH and card processing. Operators receive same-day payouts. Contractors get consolidated billing.
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#1A1A1A",
              padding: "3vh 2.5vw",
              borderLeft: "0.3vh solid #333333",
            }}
          >
            <div style={{ fontSize: "1.2vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "1vh" }}>
              Bid &amp; Quote Engine
            </div>
            <div style={{ fontSize: "1vw", color: "#888888", lineHeight: 1.5 }}>
              Operators can submit competitive bids on jobs. Contractors compare rate, ETA, and rating in one view.
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#1A1A1A",
              padding: "3vh 2.5vw",
              borderLeft: "0.3vh solid #333333",
            }}
          >
            <div style={{ fontSize: "1.2vw", fontWeight: 500, color: "#FFFFFF", marginBottom: "1vh" }}>
              Fleet SaaS Dashboard
            </div>
            <div style={{ fontSize: "1vw", color: "#888888", lineHeight: 1.5 }}>
              Brokerage firms manage their own driver pools through a white-label dispatch layer built on our core stack.
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
        <span style={{ color: "#A0785A" }}>06</span>
      </div>
    </div>
  );
}
